"use client"
import { useState, useCallback } from 'react'
import { useAuth } from './auth'
import { request } from './http'
import { z } from 'zod'

// WebAuthn registration flow
const RegistrationOptionsSchema = z.object({
  challenge: z.string(),
  rp: z.object({
    name: z.string(),
    id: z.string(),
  }),
  user: z.object({
    id: z.string(),
    name: z.string(),
    displayName: z.string(),
  }),
  pubKeyCredParams: z.array(z.object({
    type: z.literal('public-key'),
    alg: z.number(),
  })),
  authenticatorSelection: z.object({
    authenticatorAttachment: z.string().optional(),
    userVerification: z.literal('required'),
    residentKey: z.string().optional(),
  }),
  timeout: z.number(),
})

const AuthenticationOptionsSchema = z.object({
  challenge: z.string(),
  allowCredentials: z.array(z.object({
    id: z.string(),
    type: z.literal('public-key'),
  })),
  userVerification: z.literal('required'),
  timeout: z.number(),
})

const VerificationResultSchema = z.object({
  verified: z.boolean(),
  credentialId: z.string().optional(),
  aaguid: z.string().optional(),
})

export function useWebAuthn() {
  const { token } = useAuth()
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  /**
   * Enroll WebAuthn credential (TouchID/FaceID/Security Key)
   */
  const enrollCredential = useCallback(async (
    userEmail: string,
    userName: string
  ): Promise<{ success: boolean; credentialId?: string; error?: string }> => {
    if (!navigator.credentials) {
      return { success: false, error: 'WebAuthn not supported in this browser' }
    }

    setIsEnrolling(true)
    
    try {
      // 1. Get registration options from server
      const options = await request(
        '/api/webauthn/register/begin',
        RegistrationOptionsSchema,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ userEmail, userName }),
        }
      )

      // 2. Convert challenge and user ID to ArrayBuffer
      const credentialCreationOptions: CredentialCreationOptions = {
        publicKey: {
          challenge: base64ToArrayBuffer(options.challenge),
          rp: options.rp,
          user: {
            ...options.user,
            id: base64ToArrayBuffer(options.user.id),
          },
          pubKeyCredParams: options.pubKeyCredParams,
          authenticatorSelection: {
            authenticatorAttachment: 'platform' as AuthenticatorAttachment,
            userVerification: 'required' as UserVerificationRequirement,
            residentKey: 'preferred' as ResidentKeyRequirement,
          },
          timeout: options.timeout,
        },
      }

      // 3. Create credential with platform authenticator
      const credential = await navigator.credentials.create(credentialCreationOptions) as PublicKeyCredential

      if (!credential) {
        throw new Error('Credential creation failed')
      }

      // 4. Send registration response to server
      const registrationResponse = {
        id: credential.id,
        rawId: arrayBufferToBase64(credential.rawId),
        response: {
          attestationObject: arrayBufferToBase64((credential.response as AuthenticatorAttestationResponse).attestationObject),
          clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
        },
        type: credential.type,
      }

      const verification = await request(
        '/api/webauthn/register/finish',
        VerificationResultSchema,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ registrationResponse }),
        }
      )

      if (verification.verified) {
        return { success: true, credentialId: verification.credentialId }
      } else {
        return { success: false, error: 'Registration verification failed' }
      }
    } catch (error) {
      console.error('WebAuthn enrollment failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Enrollment failed' 
      }
    } finally {
      setIsEnrolling(false)
    }
  }, [token])

  /**
   * Authenticate with WebAuthn for step-up (signing ceremony)
   */
  const authenticateForSigning = useCallback(async (): Promise<{
    success: boolean
    assertion?: {
      credentialId: string
      signature: string
      authenticatorData: string
      clientDataJSON: string
    }
    error?: string
  }> => {
    if (!navigator.credentials) {
      return { success: false, error: 'WebAuthn not supported in this browser' }
    }

    setIsAuthenticating(true)

    try {
      // 1. Get authentication options from server
      const options = await request(
        '/api/webauthn/authenticate/begin',
        AuthenticationOptionsSchema,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      // 2. Convert challenge and credential IDs to ArrayBuffer
      const credentialRequestOptions: CredentialRequestOptions = {
        publicKey: {
          ...options,
          challenge: base64ToArrayBuffer(options.challenge),
          allowCredentials: options.allowCredentials.map(cred => ({
            ...cred,
            id: base64ToArrayBuffer(cred.id),
          })),
        },
      }

      // 3. Get assertion from authenticator
      const assertion = await navigator.credentials.get(credentialRequestOptions) as PublicKeyCredential

      if (!assertion) {
        throw new Error('Authentication failed')
      }

      // 4. Send authentication response to server
      const authenticationResponse = {
        id: assertion.id,
        rawId: arrayBufferToBase64(assertion.rawId),
        response: {
          authenticatorData: arrayBufferToBase64((assertion.response as AuthenticatorAssertionResponse).authenticatorData),
          clientDataJSON: arrayBufferToBase64(assertion.response.clientDataJSON),
          signature: arrayBufferToBase64((assertion.response as AuthenticatorAssertionResponse).signature),
        },
        type: assertion.type,
      }

      const verification = await request(
        '/api/webauthn/authenticate/finish',
        VerificationResultSchema,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ authenticationResponse }),
        }
      )

      if (verification.verified) {
        return {
          success: true,
          assertion: {
            credentialId: verification.credentialId!,
            signature: authenticationResponse.response.signature,
            authenticatorData: authenticationResponse.response.authenticatorData,
            clientDataJSON: authenticationResponse.response.clientDataJSON,
          },
        }
      } else {
        return { success: false, error: 'Authentication verification failed' }
      }
    } catch (error) {
      console.error('WebAuthn authentication failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      }
    } finally {
      setIsAuthenticating(false)
    }
  }, [token])

  return {
    enrollCredential,
    authenticateForSigning,
    isEnrolling,
    isAuthenticating,
  }
}

// Utility functions for ArrayBuffer <-> Base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// Hook for document signing with step-up
export function useDocumentSigning() {
  const { authenticateForSigning } = useWebAuthn()
  const { token } = useAuth()
  const [isSigning, setIsSigning] = useState(false)

  const signDocument = useCallback(async (
    entity: 'RX' | 'LAB_ORDER' | 'DOCUMENT',
    entityId: string,
    title: string,
    patientId: string,
    documentBlob: Blob
  ): Promise<{ success: boolean; signatureEventId?: string; error?: string }> => {
    setIsSigning(true)

    try {
      // 1. Step-up authentication with WebAuthn
      const authResult = await authenticateForSigning()
      
      if (!authResult.success) {
        return { success: false, error: authResult.error || 'Step-up authentication failed' }
      }

      // 2. Convert document to buffer
      const documentBuffer = await documentBlob.arrayBuffer()

      // 3. Create FormData for multipart upload
      const formData = new FormData()
      formData.append('document', documentBlob)
      formData.append('entity', entity)
      formData.append('entityId', entityId)
      formData.append('title', title)
      formData.append('patientId', patientId)
      
      if (authResult.assertion) {
        formData.append('webauthnAssertion', JSON.stringify(authResult.assertion))
      }

      // 4. Submit to signature API
      const response = await fetch('/api/signatures/sign', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Signing failed: ${response.status} ${errorText}`)
      }

      const result = await response.json()

      return { success: true, signatureEventId: result.signatureEventId }
    } catch (error) {
      console.error('Document signing failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Signing failed' 
      }
    } finally {
      setIsSigning(false)
    }
  }, [authenticateForSigning, token])

  return {
    signDocument,
    isSigning,
  }
}
