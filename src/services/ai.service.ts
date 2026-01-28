import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CacheService } from '../common/cache.service';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private readonly openai: OpenAI;
    private readonly model: string;
    private readonly maxTokens: number;

    constructor(
        private configService: ConfigService,
        private cacheService: CacheService
    ) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o';
        this.maxTokens = parseInt(this.configService.get<string>('OPENAI_MAX_TOKENS') || '4000', 10);

        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        } else {
            this.logger.warn('OPENAI_API_KEY not found. AI features will fail or run in mock mode.');
        }
    }

    /**
     * Generates a clinical summary from various patient data points
     */
    async generatePatientSummary(data: {
        demographics?: any;
        appointments?: any[];
        notes?: any[];
        forms?: any[];
        files?: any[];
        observations?: any[];
    }): Promise<string> {
        if (!this.openai) return this.mockSummary();

        const { demographics, appointments, notes, forms, files, observations } = data;
        const patientId = demographics?.id || demographics?.name || 'anonymous';
        const cacheKey = `ai:summary:${patientId}`;

        return this.cacheService.coalescedFetch(cacheKey, async () => {
            try {
                const prompt = `
            You are an expert clinical assistant. Generate a comprehensive, easy-to-read clinical summary for the following patient.
            
            ### Patient Data
            - **Name**: ${demographics?.name || 'Unknown'}
            - **Age/DOB**: ${demographics?.dob || demographics?.age || 'Unknown'}
            - **Gender**: ${demographics?.gender || 'Unknown'}
            
            ### Recent Clinical Activity
            - **Appointments**: ${JSON.stringify(appointments || [])}
            - **Doctor Notes**: ${JSON.stringify(notes || [])}
            - **Intake Forms**: ${JSON.stringify(forms || [])}
            - **Uploaded Files**: ${JSON.stringify(files || [])}
            - **Latest Observations**: ${JSON.stringify(observations || [])}

            ### Instructions
            1. **Analyze** all provided data points to form a holistic view of the patient's status.
            2. **Format** the output in clean, readable Markdown.
            3. **Structure** the summary into these specific sections:
               - **### Clinical Overview**: A high-level summary of the patient's current status and reason for recent visits.
               - **### Key History & Facts**: Important demographic details, chronic conditions (if inferred), and recent history.
               - **### Recent Observations**: Highlights from doctor notes and intake forms.
               - **### File Attachments**: Briefly mention what key files/reports are available (e.g., "Lab Report from Jan 15").
               - **### Recommended Actions**: Suggested next steps based on the latest visit or notes.

            Keep the tone professional, concise, and clinically relevant. Do not invent information not present in the data.
            `;

                const completion = await this.openai.chat.completions.create({
                    messages: [{ role: 'system', content: prompt }],
                    model: this.model,
                    max_tokens: this.maxTokens,
                });

                return completion.choices[0].message.content || 'No summary generated.';
            } catch (error) {
                throw new Error('Failed to generate summary');
            }
        }, 1000 * 60 * 10); // Cache for 10 minutes
    }

    /**
     * AI-assisted note generation for doctors
     */
    async generateNotes(context: string, prompt: string): Promise<string> {
        if (!this.openai) return '[Mock] Generated notes based on input...';

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a medical scribe. Help draft professional clinical notes based on the provided context and doctor\'s shorthand instructions.'
                    },
                    { role: 'user', content: `Context: ${context}\n\nInstruction: ${prompt}` }
                ],
                model: this.model,
                max_tokens: this.maxTokens,
            });

            return completion.choices[0].message.content || '';
        } catch (error) {
            this.logger.error('Failed to generate notes', error);
            throw error;
        }
    }

    /**
     * Transcribes audio using Whisper API
     */
    async transcribeAudio(audioFile: Express.Multer.File): Promise<string> {
        if (!this.openai) return '[Mock] Transcribed audio text...';

        // OpenAI Whisper limit is 25MB
        const MAX_SIZE = 25 * 1024 * 1024;
        if (audioFile.size > MAX_SIZE) {
            this.logger.error(`Audio file size (${(audioFile.size / 1024 / 1024).toFixed(2)}MB) exceeds OpenAI Whisper limit of 25MB.`);
            throw new Error(`The recording is too long and exceeds the 25MB limit for AI processing. Please upload smaller chunks or a lower bitrate recording.`);
        }

        try {
            // Convert buffer to file-like object for OpenAI if needed
            const file = await OpenAI.toFile(audioFile.buffer, audioFile.originalname || 'audio.mp3');

            const transcription = await this.openai.audio.transcriptions.create({
                file: file,
                model: 'whisper-1',
            });

            return transcription.text;
        } catch (error) {
            this.logger.error('Failed to transcribe audio', error);
            throw error;
        }
    }

    /**
     * Summarizes a meeting transcript
     */
    async summarizeMeeting(transcript: string): Promise<string> {
        if (!this.openai) return '[Mock] Meeting summary...';

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'Summarize the following medical consultation. Extract key symptoms, diagnoses, action items, and next steps.'
                    },
                    { role: 'user', content: transcript }
                ],
                model: 'gpt-4o',
            });

            return completion.choices[0].message.content || '';
        } catch (error) {
            this.logger.error('Failed to summarize meeting', error);
            throw error;
        }
    }

    /**
     * Specialized conversational summarization with speaker segmentation
     */
    async summarizeConversation(conversation: any[]): Promise<any> {
        if (!this.openai) {
            return {
                patient_summary: "Patient discussed symptoms and concerns.",
                doctor_summary: "Doctor provided guidance and next steps.",
                key_points: ["Symptom analysis", "Diagnostic discussion"],
                action_items: ["Follow up in 2 weeks"]
            };
        }

        const formattedTranscript = conversation
            .map(m => `[${m.speaker.toUpperCase()} - ${m.timestamp}]: ${m.text}`)
            .join('\n');

        const systemPrompt = `
        You are a medical transcription assistant. Analyze the provided doctor-patient conversation.
        
        Tasks:
        1. Summarize patient statements into a concise patient summary.
        2. Summarize doctor instructions into a doctor summary.
        3. Highlight key points (symptoms, vitals, medications, advice).
        4. Extract actionable items for both doctor and patient (follow-ups, tests, medications, lifestyle).

        Strictly return only a JSON object with this structure:
        {
          "patient_summary": "Concise summary of patient's input",
          "doctor_summary": "Concise summary of doctor's instructions",
          "key_points": ["Point 1", "Point 2"],
          "action_items": ["Action 1", "Action 2"]
        }
        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: formattedTranscript }
                ],
                model: 'gpt-4o',
                response_format: { type: 'json_object' }
            });
            return JSON.parse(completion.choices[0].message.content || '{}');
        } catch (error) {
            this.logger.error('Failed to summarize conversation', error);
            throw error;
        }
    }

    /**
     * Generates a structured SOAP note from a clinical conversation
     */
    async generateSoapNote(conversation: any[]): Promise<any> {
        if (!this.openai) {
            return {
                subjective: "Patient reports persistent headaches for 3 days, described as 'throbbing'. Worse in the morning.",
                objective: "Patient appears uncomfortable. BP mentioned as normal at home.",
                assessment: "Likely tension headache, but migraine should be ruled out.",
                plan: "Prescribe ibuprofen 400mg as needed. Follow up if symptoms worsen."
            };
        }

        const formattedTranscript = conversation
            .map(m => `[${m.speaker.toUpperCase()}]: ${m.text}`)
            .join('\n');

        const cacheKey = `ai:soap:${Buffer.from(formattedTranscript).slice(-32).toString('hex')}`;

        return this.cacheService.coalescedFetch(cacheKey, async () => {
            const systemPrompt = `
        You are a highly skilled medical scribe. Your task is to convert the following doctor-patient conversation into a professional, concise, and structured SOAP note.
        
        Guidelines:
        - Use professional medical terminology (e.g., "erythematous" instead of "red").
        - Be concise but complete.
        - Never invent facts. Only use what is present in the transcript.
        - Clearly separate patient's subjective complaints from doctor's objective findings.
        
        Sections:
        - **Subjective**: Presenting complaint, history of present illness (HPI), symptoms reported by the patient.
        - **Objective**: Vital signs, physical examination findings, and observations discussed during the visit.
        - **Assessment**: Differential diagnosis, clinical reasoning, or confirmed diagnoses.
        - **Plan**: Medications (name, dosage, frequency), diagnostic tests ordered, follow-up instructions, and patient education.

        Return strictly a JSON object:
        {
          "subjective": "...",
          "objective": "...",
          "assessment": "...",
          "plan": "..."
        }
        `;

            try {
                const completion = await this.openai.chat.completions.create({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: formattedTranscript }
                    ],
                    model: 'gpt-4o',
                    response_format: { type: 'json_object' }
                });
                return JSON.parse(completion.choices[0].message.content || '{}');
            } catch (error) {
                this.logger.error('Failed to generate SOAP note', error);
                throw error;
            }
        }, 1000 * 60 * 5); // Cache for 5 minutes
    }

    /**
     * Structures a solo clinical dictation into EHR fields
     */
    async structureClinicalDictation(dictation: string): Promise<any> {
        if (!this.openai) {
            return { subjective: dictation, objective: '', assessment: '', plan: '' };
        }

        const systemPrompt = `
        You are a medical scribe structuring a doctor's solo dictation into a clinical note.
        The doctor is speaking shorthand or descriptive notes. Parse this into the appropriate SOAP sections.
        
        If the doctor mentions only one section (e.g., "Plan: follow up in two weeks"), place it there. 
        If the dictation is general, distribute findings into Subjective, Objective, Assessment, and Plan as appropriate.
        
        Return strictly a JSON object:
        {
          "subjective": "...",
          "objective": "...",
          "assessment": "...",
          "plan": "..."
        }
        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: dictation }
                ],
                model: 'gpt-4o',
                response_format: { type: 'json_object' }
            });
            return JSON.parse(completion.choices[0].message.content || '{}');
        } catch (error) {
            this.logger.error('Failed to structure dictation', error);
            throw error;
        }
    }

    /**
     * Extracts vitals from a conversation transcript
     */
    async extractVitals(transcript: string): Promise<any> {
        if (!this.openai) return {};

        const systemPrompt = `
        Search the medical transcript for any mention of patient vitals.
        Extract: BP (systolic/diastolic), Heart Rate, Respiratory Rate, Temperature, Weight, Height, SpO2.
        
        Return only a JSON object with keys like: 
        {
          "bpSystolic": number,
          "bpDiastolic": number,
          "heartRate": number,
          "respiratoryRate": number,
          "temperature": number,
          "weight": number,
          "height": number,
          "spO2": number
        }
        Only include keys for which data was found. Use null or omit for missing values.
        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: transcript }
                ],
                model: 'gpt-4o',
                response_format: { type: 'json_object' }
            });
            return JSON.parse(completion.choices[0].message.content || '{}');
        } catch (error) {
            this.logger.error('Failed to extract vitals', error);
            return {};
        }
    }

    /**
     * Smartly segments raw transcript into [Doctor] and [Patient] blocks
     */
    async segmentConversation(transcript: string): Promise<string> {
        if (!this.openai) return transcript;

        const systemPrompt = `
        You are a medical transcription assistant. Review the raw transcription of a doctor-patient interaction.
        Your goal is to reconstruct the dialogue by identifying who is speaking based on clinical context and linguistic cues.
        
        Labels:
        - [Doctor]: For medical advice, questions about symptoms, instructions, or assessments.
        - [Patient]: For descriptions of symptoms, medical history, or questions about care.

        Format the output as a clean dialogue transcript. 
        Example:
        [Doctor]: How can I help you today?
        [Patient]: I've been feeling short of breath.
        [Doctor]: When did this start?
        
        Only return the reconstructed dialogue.
        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: transcript }
                ],
                model: 'gpt-4o',
                temperature: 0.3, // Lower temperature for more consistent segmentation
            });

            return completion.choices[0].message.content || transcript;
        } catch (error) {
            this.logger.error('Failed to segment conversation', error);
            return transcript; // Fallback to raw
        }
    }

    /**
     * Summarizes an intake session (array of messages)
     */
    async summarize(messages: any[]): Promise<string> {
        if (!messages || messages.length === 0) return '';

        const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        if (!this.openai) return `[Mock Summary of ${messages.length} messages]`;

        // Reuse summarizeMeeting or custom prompt
        return this.summarizeMeeting(transcript);
    }

    // --- Legacy / Compatibility Methods (Optional, kept to avoid breaking changes if any) ---

    async chat(messages: any[], context: string): Promise<string> {
        if (!this.openai) return this.mockChatResponse(messages);
        // Implementation for chat if needed
        return this.mockChatResponse(messages);
    }

    private mockSummary(): string {
        return `[MOCK SUMMARY] Patient reports symptoms consistent with tension headache. Duration: 3 days. Severity: 4/10. No aura reported.`;
    }

    private mockChatResponse(messages: any[]): string {
        const lastUserMsg = messages[messages.length - 1]?.content.toLowerCase() || '';
        if (lastUserMsg.includes('headache')) return "How long have you been experiencing this headache?";
        return "Could you tell me a bit more about your symptoms?";
    }
}
