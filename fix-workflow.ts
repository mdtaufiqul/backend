import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixWorkflowConfiguration() {
    console.log('🔧 Fixing Workflow Configuration...\n');

    // Find the APPOINTMENT_CREATED workflow
    const workflows = await prisma.workflowDefinition.findMany({
        where: { triggerType: 'APPOINTMENT_CREATED' }
    });

    if (workflows.length === 0) {
        console.log('❌ No APPOINTMENT_CREATED workflow found!');
        console.log('Creating a new workflow with proper email configuration...\n');

        // Create a properly configured workflow
        const newWorkflow = await prisma.workflowDefinition.create({
            data: {
                name: 'Appointment Confirmation Email',
                triggerType: 'APPOINTMENT_CREATED',
                patientType: 'ALL',
                isActive: true,
                nodes: [
                    {
                        id: '1',
                        type: 'trigger',
                        position: { x: 100, y: 100 },
                        data: { label: 'Appointment Created' }
                    },
                    {
                        id: '2',
                        type: 'action',
                        position: { x: 100, y: 250 },
                        data: {
                            label: 'Send Confirmation Email',
                            actionType: 'email',
                            subject: 'Appointment Confirmation - {{fullName}}',
                            payload: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Appointment Confirmed!</h2>
  
  <p>Dear {{fullName}},</p>
  
  <p>Your appointment has been successfully scheduled.</p>
  
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>Date:</strong> {{date}}</p>
    <p style="margin: 5px 0;"><strong>Time:</strong> {{time}}</p>
    {{#if link}}
    <p style="margin: 5px 0;"><strong>Meeting Link:</strong> <a href="{{link}}">Join Video Call</a></p>
    {{/if}}
  </div>
  
  <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
  
  <p>Thank you for choosing our services!</p>
  
  <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
    This is an automated message. Please do not reply to this email.
  </p>
</div>
              `.trim()
                        }
                    }
                ],
                edges: [
                    {
                        id: 'e1-2',
                        source: '1',
                        target: '2'
                    }
                ]
            }
        });

        console.log('✅ Created new workflow:', newWorkflow.id);
        console.log('   Name:', newWorkflow.name);
        console.log('   Trigger:', newWorkflow.triggerType);
        console.log('   Active:', newWorkflow.isActive);
    } else {
        console.log(`Found ${workflows.length} APPOINTMENT_CREATED workflow(s)\n`);

        for (const workflow of workflows) {
            console.log(`📋 Workflow: ${workflow.name} (${workflow.id})`);
            console.log(`   Active: ${workflow.isActive}`);

            const nodes = workflow.nodes as any[];
            const actionNode = nodes.find(n => n.type === 'action');

            if (!actionNode) {
                console.log('   ⚠️  No action node found!');
                continue;
            }

            if (!actionNode.data?.actionType || !actionNode.data?.payload) {
                console.log('   ❌ Action node missing configuration!');
                console.log('   Fixing...');

                // Update the action node with proper configuration
                const updatedNodes = nodes.map(node => {
                    if (node.type === 'action') {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                label: 'Send Confirmation Email',
                                actionType: 'email',
                                subject: 'Appointment Confirmation - {{fullName}}',
                                payload: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Appointment Confirmed!</h2>
  
  <p>Dear {{fullName}},</p>
  
  <p>Your appointment has been successfully scheduled.</p>
  
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>Date:</strong> {{date}}</p>
    <p style="margin: 5px 0;"><strong>Time:</strong> {{time}}</p>
    {{#if link}}
    <p style="margin: 5px 0;"><strong>Meeting Link:</strong> <a href="{{link}}">Join Video Call</a></p>
    {{/if}}
  </div>
  
  <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
  
  <p>Thank you for choosing our services!</p>
  
  <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
    This is an automated message. Please do not reply to this email.
  </p>
</div>
                `.trim()
                            }
                        };
                    }
                    return node;
                });

                await prisma.workflowDefinition.update({
                    where: { id: workflow.id },
                    data: { nodes: updatedNodes }
                });

                console.log('   ✅ Fixed action node configuration!');
            } else {
                console.log('   ✅ Action node properly configured');
                console.log('      Type:', actionNode.data.actionType);
                console.log('      Subject:', actionNode.data.subject);
            }
        }
    }

    console.log('\n✅ Workflow configuration complete!');
    console.log('\n📧 Next appointment will trigger email notification.');
}

fixWorkflowConfiguration()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
