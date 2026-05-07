// api/submit-lead.js
// Vercel serverless function to handle lead form submissions

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, whatsapp, email, plan, goal, experience, note, timestamp } = req.body;

  // Validate required fields
  if (!name || !whatsapp || !email || !plan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Initialize Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // Insert lead into database
    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          name,
          whatsapp,
          email,
          plan,
          goal,
          experience,
          note,
          submitted_at: timestamp,
          status: 'new',
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Decrease spots count
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('spots_available')
      .eq('id', 1)
      .single();

    if (!configError && config) {
      const newSpots = Math.max(0, config.spots_available - 1);
      await supabase
        .from('config')
        .update({ spots_available: newSpots })
        .eq('id', 1);
    }

    // Optional: Send WhatsApp notification to Yves
    // Use Twilio or manual notification

    return res.status(200).json({
      success: true,
      message: 'Lead submitted successfully',
      leadId: data?.[0]?.id
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
