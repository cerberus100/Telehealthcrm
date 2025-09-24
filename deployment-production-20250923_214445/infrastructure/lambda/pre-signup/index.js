# Pre-Signup Lambda Function
const AWS = require('aws-sdk');

exports.handler = async (event) => {
    console.log('Pre-signup event:', JSON.stringify(event, null, 2));
    
    try {
        // Auto-confirm users for demo purposes
        // In production, you might want to validate email domains, etc.
        event.response.autoConfirmUser = true;
        event.response.autoVerifyEmail = true;
        
        console.log('Pre-signup completed successfully');
        return event;
    } catch (error) {
        console.error('Pre-signup error:', error);
        throw error;
    }
};
