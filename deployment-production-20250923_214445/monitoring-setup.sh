#!/bin/bash
# Production Monitoring and Alerting Setup

echo "📊 Setting up production monitoring..."

# CloudWatch Dashboards
echo "Creating CloudWatch dashboards..."
aws cloudwatch put-dashboard \
  --dashboard-name "Telehealth-Platform-Overview" \
  --dashboard-body file://monitoring/dashboard-overview.json

aws cloudwatch put-dashboard \
  --dashboard-name "Telehealth-Security-Monitoring" \
  --dashboard-body file://monitoring/dashboard-security.json

# CloudWatch Alarms
echo "Creating CloudWatch alarms..."
aws cloudwatch put-metric-alarm \
  --alarm-name "High-CPU-Utilization" \
  --alarm-description "CPU utilization is high" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

aws cloudwatch put-metric-alarm \
  --alarm-name "High-Memory-Utilization" \
  --alarm-description "Memory utilization is high" \
  --metric-name MemoryUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# SNS Topics for Alerts
echo "Creating SNS topics for alerts..."
aws sns create-topic --name telehealth-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:telehealth-alerts \
  --protocol email \
  --notification-endpoint alerts@yourcompany.com

echo "✅ Monitoring setup completed"
