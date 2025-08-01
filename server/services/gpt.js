import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY, // support either var if legacy
});

/**
 * Parameters:
 *  - input: candidate's latest answer / utterance (string)
 *  - opts: {
 *      role: 'frontend developer' | 'sales' | 'marketing' | 'management' | etc.,
 *      resumeSummary: string (optional brief summary of candidate background),
 *      previousQAs: Array<{ user: string, assistant: string }>  // conversation history
 *    }
 */
export async function getInterviewResponse(input, opts = {}) {
  const {
    role = 'general',
    resumeSummary = '',
    previousQAs = [],
  } = opts;

  // System prompt: persona + guidelines
  const systemPrompt = `
You are a professional AI job interviewer. Your goal is to conduct a structured, adaptive, and conversational interview tailored to the candidate's role: "${role}". 
Use the STAR method for behavioral questions (Situation, Task, Action, Result). 
Assess technical depth where applicable, adjust difficulty based on candidate responses, and blend soft skills evaluation (communication, leadership, problem-solving). 
Be supportive and professional; acknowledge nervousness briefly and encourage. 
Ask clarifying follow-ups if answers are vague. 
Never interrupt while speaking; wait for the candidate to finish before asking the next question. 
Keep the flow natural with smooth transitions. 
If the candidate has provided a resume summary, incorporate that when asking about background or experience. 
At appropriate times, summarize strengths/weaknesses lightly to guide the next question.
`;

  // Build message array preserving prior context
  const messages = [
    { role: 'system', content: systemPrompt.trim() },
  ];

  if (resumeSummary) {
    messages.push({
      role: 'system',
      content: `Candidate background/resume summary: ${resumeSummary}`,
    });
  }

  // Inject previous Q&A to give the model context
  for (const pair of previousQAs) {
    if (pair.user) {
      messages.push({ role: 'user', content: pair.user });
    }
    if (pair.assistant) {
      messages.push({ role: 'assistant', content: pair.assistant });
    }
  }

  // Current user input
  messages.push({ role: 'user', content: input });

  // Optional: adjust instructions based on role type for more specificity
  if (role.toLowerCase().includes('technical')) {
    messages.push({
      role: 'system',
      content: 'Focus more on system design, algorithms, debugging, and code reasoning for technical depth.',
    });
  } else if (role.toLowerCase().includes('sales')) {
    messages.push({
      role: 'system',
      content: 'Evaluate persuasion, objection handling, customer empathy, and deal-closing logic.',
    });
  } else if (role.toLowerCase().includes('marketing')) {
    messages.push({
      role: 'system',
      content: 'Assess strategy, audience understanding, campaign measurement, and creative thinking.',
    });
  } else if (role.toLowerCase().includes('management')) {
    messages.push({
      role: 'system',
      content: 'Probe leadership style, conflict resolution, team development, and decision-making process.',
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // or 'gpt-4' if you prefer
      messages,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0.3,
    });

    const content = response.choices?.[0]?.message?.content?.trim() || '';
    return content;
  } catch (err) {
    console.error('❌ GPT error:', err?.message || err);
    // Fallback polite message
    return "Thanks for that. Could you please elaborate a bit more on that?";
  }
}
