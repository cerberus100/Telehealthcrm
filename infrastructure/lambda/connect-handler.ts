import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const eventBridgeClient = new EventBridgeClient({ region: process.env.AWS_REGION });

interface ConnectEvent {
  Details: {
    ContactData: {
      ContactId: string;
      CustomerEndpoint: {
        Address: string;
        Type: string;
      };
      SystemEndpoint: {
        Address: string;
        Type: string;
      };
      Attributes: Record<string, string>;
      Channel: string;
      InitiationMethod: string;
      InitiationTimestamp: string;
      PreviousContactId?: string;
      QueueInfo?: {
        Name: string;
        QueueARN: string;
      };
    };
    Parameters: Record<string, string>;
  };
}

interface PatientRecord {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

interface ConsultRecord {
  id: string;
  patientId: string;
  providerId?: string;
  status: 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  callId: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Amazon Connect Lambda Handler - Inbound Call Event:', JSON.stringify(event, null, 2));

  try {
    const connectEvent = event as unknown as ConnectEvent;
    const contactData = connectEvent.Details.ContactData;
    
    // Extract call information
    const callId = contactData.ContactId;
    const phoneNumber = contactData.CustomerEndpoint.Address;
    const timestamp = new Date(contactData.InitiationTimestamp).toISOString();

    console.log(`Processing inbound call: ${callId} from ${phoneNumber}`);

    // Generate unique IDs
    const patientId = `patient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const consultId = `consult_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create or update patient record
    const patientRecord: PatientRecord = {
      id: patientId,
      phoneNumber: phoneNumber,
      orgId: process.env.DEFAULT_ORG_ID || 'default-org',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Create consult record
    const consultRecord: ConsultRecord = {
      id: consultId,
      patientId: patientId,
      status: 'INITIATED',
      callId: callId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Store records in DynamoDB (or call API)
    await storeCallRecords(patientRecord, consultRecord);

    // Store call recording metadata in S3
    await storeCallMetadata(callId, phoneNumber, timestamp);

    // Emit event to EventBridge for downstream processing
    await emitCallEvent(consultRecord);

    // Return success response to Amazon Connect
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        patientId: patientId,
        consultId: consultId,
        callId: callId,
        message: 'Call processed successfully',
      }),
    };

  } catch (error) {
    console.error('Error processing Amazon Connect call:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

async function storeCallRecords(patient: PatientRecord, consult: ConsultRecord): Promise<void> {
  try {
    // Store patient record
    await docClient.send(new PutCommand({
      TableName: process.env.PATIENTS_TABLE,
      Item: patient,
    }));

    // Store consult record
    await docClient.send(new PutCommand({
      TableName: process.env.CONSULTS_TABLE,
      Item: consult,
    }));

    console.log(`Stored records - Patient: ${patient.id}, Consult: ${consult.id}`);
  } catch (error) {
    console.error('Error storing call records:', error);
    throw error;
  }
}

async function storeCallMetadata(callId: string, phoneNumber: string, timestamp: string): Promise<void> {
  try {
    const metadata = {
      callId: callId,
      phoneNumber: phoneNumber,
      timestamp: timestamp,
      status: 'RECORDING_IN_PROGRESS',
      bucket: process.env.CALL_RECORDINGS_BUCKET,
      key: `recordings/${callId}.wav`,
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.CALL_METADATA_BUCKET,
      Key: `metadata/${callId}.json`,
      Body: JSON.stringify(metadata),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
    }));

    console.log(`Stored call metadata for call: ${callId}`);
  } catch (error) {
    console.error('Error storing call metadata:', error);
    throw error;
  }
}

async function emitCallEvent(consult: ConsultRecord): Promise<void> {
  try {
    await eventBridgeClient.send(new PutEventsCommand({
      Entries: [
        {
          Source: 'telehealth.connect',
          DetailType: 'Consult Created',
          Detail: JSON.stringify({
            consultId: consult.id,
            patientId: consult.patientId,
            callId: consult.callId,
            status: consult.status,
            timestamp: consult.createdAt,
          }),
        },
      ],
    }));

    console.log(`Emitted consult.created event for: ${consult.id}`);
  } catch (error) {
    console.error('Error emitting call event:', error);
    throw error;
  }
}
