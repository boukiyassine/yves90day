// api/generate-plan.js
// Uses Claude API to generate personalized diet + workout plans

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'Missing clientId' });
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

    // 1. Fetch client intake data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // 2. Build prompt for Claude
    const prompt = `You are a professional fitness coach. Generate a personalized 90-day coaching plan for this client:

CLIENT PROFILE:
- Name: ${client.name}
- Age: ${client.age}
- Weight: ${client.weight_kg}kg
- Height: ${client.height_cm}cm
- Goal: ${client.goal || 'General fitness'}
- Experience: ${client.training_experience}
- Current Workout Split: ${client.current_workout_split}
- Training Days/Week: ${client.training_days_per_week}
- Preferred Training Time: ${client.preferred_training_time}
- Injuries/Limitations: ${client.injuries || 'None'}
- Current Diet: ${client.diet_description}
- Food Allergies: ${client.food_allergies || 'None'}
- Meals/Day: ${client.meals_per_day}
- Current Supplements: ${client.current_supplements}
- Sleep Hours: ${client.sleep_hours}h
- Stress Level: ${client.stress_level}
- Notes: ${client.additional_notes}

GENERATE (in JSON format):

1. MACROS CALCULATION:
   - Calculate TDEE (Total Daily Energy Expenditure)
   - Adjust calories based on goal
   - Calculate protein (grams)
   - Calculate carbs (grams)
   - Calculate fats (grams)

2. DIET PLAN:
   - Create 4-5 sample meal templates per day
   - Include protein, carb, fat sources
   - Simple, practical meals (Tunisia-friendly options preferred)
   - Meal timing based on preferred training time
   - Supplements to take

3. WORKOUT PROGRAM:
   - Create 4-week block (repeat 3 times for 12 weeks)
   - Exercises per session (name, sets x reps, rest)
   - Progressive overload strategy
   - Rest day activities

4. TRACKING:
   - Weekly weigh-in schedule
   - Body measurement locations
   - Progress photos (frequency)
   - Checkin frequency (weekly calls)

5. SUPPLEMENTS:
   - Based on goal and budget
   - Priority ranking (must-have vs nice-to-have)
   - American Wolf products recommended (RECUPA alternative)

Format response ONLY as valid JSON with keys: tdee, protein_g, carbs_g, fats_g, diet_plan, workout_plan, supplements, tracking, notes`;

    // 3. Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const planContent = message.content[0].text;

    // Parse JSON response
    let planData;
    try {
      // Extract JSON from response (in case Claude adds extra text)
      const jsonMatch = planContent.match(/\{[\s\S]*\}/);
      planData = JSON.parse(jsonMatch ? jsonMatch[0] : planContent);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse plan data' });
    }

    // 4. Store plan in database
    const { data: plan, error: planError } = await supabase
      .from('client_plans')
      .insert([
        {
          client_id: clientId,
          tdee: planData.tdee,
          protein_g: planData.protein_g,
          carbs_g: planData.carbs_g,
          fats_g: planData.fats_g,
          diet_plan_json: planData.diet_plan,
          workout_plan_json: planData.workout_plan,
          supplement_recommendations: planData.supplements,
          generated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (planError) {
      console.error('Plan storage error:', planError);
      return res.status(500).json({ error: 'Failed to store plan' });
    }

    // 5. Update client status
    await supabase
      .from('clients')
      .update({
        status: 'plan_ready',
        plan_delivered_at: new Date().toISOString()
      })
      .eq('id', clientId);

    return res.status(200).json({
      success: true,
      planId: plan.id,
      plan: {
        tdee: planData.tdee,
        macros: {
          protein: planData.protein_g,
          carbs: planData.carbs_g,
          fats: planData.fats_g
        },
        diet: planData.diet_plan,
        workout: planData.workout_plan,
        supplements: planData.supplements,
        tracking: planData.tracking
      }
    });

  } catch (error) {
    console.error('Error generating plan:', error);
    return res.status(500).json({ error: 'Server error generating plan' });
  }
}
