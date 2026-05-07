// api/submit-intake.js
// Saves completed intake form data to clients table

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    clientId,
    name,
    whatsapp,
    email,
    plan,
    age,
    weight_kg,
    height_cm,
    goal,
    physique_description,
    training_experience,
    current_workout_split,
    training_days_per_week,
    preferred_training_time,
    injuries,
    diet_description,
    food_allergies,
    meals_per_day,
    current_supplements,
    sleep_hours,
    stress_level,
    additional_notes,
    submitted_at
  } = req.body;

  if (!clientId || !name || !weight_kg || !height_cm) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // Update client record with intake data
    const { data, error } = await supabase
      .from('clients')
      .update({
        name,
        whatsapp,
        email,
        plan,
        age,
        weight_kg,
        height_cm,
        goal,
        physique_description,
        training_experience,
        current_workout_split,
        training_days_per_week,
        preferred_training_time,
        injuries,
        diet_description,
        food_allergies,
        meals_per_day,
        current_supplements,
        sleep_hours,
        stress_level,
        additional_notes,
        status: 'plan_pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to save intake data' });
    }

    return res.status(200).json({
      success: true,
      message: 'Intake form submitted. Plan generation starting...',
      clientId: data.id
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
