-- Check workflow definitions
SELECT id, name, "triggerType", "isActive", nodes::text 
FROM "WorkflowDefinition" 
WHERE "triggerType" = 'APPOINTMENT_CREATED';

-- Check recent workflow instances
SELECT id, "workflowId", status, "currentNodeId", "contextData"::text
FROM "WorkflowInstance"
ORDER BY "createdAt" DESC
LIMIT 5;

-- Check communication logs
SELECT id, type, status, direction, "createdAt"
FROM "CommunicationLog"
ORDER BY "createdAt" DESC
LIMIT 10;
