// api/analyze-body.js
// Uses Claude Vision API to analyze client photos before calls

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientId, photoUrl } = req.body;

  if (!clientId || !photoUrl) {
    return res.status(400).json({ error: 'Missing clientId or photoUrl' });
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const Anthropic = require('@anthropic-ai/sdk');

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // 1. Fetch client data for context
    const { data: client } = await supabase
      .from('clients')
      .select('name, goal, weight_kg, age')
      .eq('id', clientId)
      .single();

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // 2. Call Claude Vision to analyze photo
    const visionMessage = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'url',
                url: photoUrl
              }
            },
            {
              type: 'text',
              text: `You are a professional fitness coach analyzing a client's physique. 

CLIENT CONTEXT:
- Name: ${client.name}
- Goal: ${client.goal}
- Current Weight: ${client.weight_kg}kg
- Age: ${client.age}

ANALYZE THIS PHOTO AND PROVIDE:

1. POSTURE ASSESSMENT:
   - Head position (forward, neutral, etc)
   - Shoulder alignment (symmetric, rounded forward, etc)
   - Spine alignment (straight, sway back, etc)
   - Hip alignment (level, tilted, etc)

2. MUSCLE DEVELOPMENT:
   - Visible muscle groups (chest, shoulders, arms, legs)
   - Symmetries and asymmetries
   - Areas of strength
   - Areas needing development relative to their goal

3. PROBLEM AREAS (relative to their goal):
   - Weak points to focus on
   - Muscle imbalances
   - Postural issues causing problems
   - Body comp assessment (muscle vs fat)

4. SPECIFIC RECOMMENDATIONS FOR THEIR CALL:
   - 3 key talking points to discuss in the onboarding call
   - Specific exercises to emphasize in their program
   - Nutrition focus areas
   - Movement quality improvements needed

5. TRAINING EMPHASIS:
   - Primary focus areas
   - Secondary focus areas
   - Avoid or modify (if any)

Keep it direct, specific, and actionable. This will be read by the coach before calling the client.`
            }
          ]
        }
      ]
    });

    const analysis = visionMessage.content[0].text;

    // 3. Store analysis in database
    const { data: photo, error: photoError } = await supabase
      .from('client_photos')
      .insert([
        {
          client_id: clientId,
          photo_url: photoUrl,
          photo_type: 'starting',
          ai_analysis: analysis,
          uploaded_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (photoError) {
      console.error('Photo storage error:', photoError);
      return res.status(500).json({ error: 'Failed to store analysis' });
    }

    return res.status(200).json({
      success: true,
      photoId: photo.id,
      analysis: analysis,
      message: 'Body analysis complete. Use this before the call with your client.'
    });

  } catch (error) {
    console.error('Error analyzing body:', error);
    return res.status(500).json({ error: 'Server error analyzing photo' });
  }
}
