# Post-Confirmation Lambda Function
const AWS = require('aws-sdk');

exports.handler = async (event) => {
    console.log('Post-confirmation event:', JSON.stringify(event, null, 2));
    
    try {
        // Log user confirmation for audit purposes
        const userId = event.request.userAttributes.sub;
        const email = event.request.userAttributes.email;
        
        console.log(`User confirmed: ${userId} (${email})`);
        
        // In a real implementation, you might:
        // 1. Create user profile in your database
        // 2. Send welcome email
        // 3. Set up user preferences
        // 4. Log audit event
        
        return event;
    } catch (error) {
        console.error('Post-confirmation error:', error);
        throw error;
    }
};
