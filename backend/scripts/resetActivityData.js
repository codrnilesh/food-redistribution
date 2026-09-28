const supabase = require('../src/db/supabaseClient');

async function resetActivity() {
  console.log('Starting activity reset (keeping profiles, hubs, hub_edges)...');

  const tables = [
    'route_stops',
    'routes',
    'allocations',
    'allocation_runs',
    'donations',
    'requests',
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .not('id', 'is', null);

    if (error) {
      console.error(`Error clearing ${table}:`, error.message);
    } else {
      console.log(`Cleared ${table} successfully.`);
    }
  }

  console.log('\n--- Verification ---');
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    console.log(`Remaining in ${table}: ${count !== null && count !== undefined ? count : (error ? error.message : 0)}`);
  }

  const { count: profileCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  console.log(`Preserved profiles: ${profileCount}`);

  const { count: hubCount } = await supabase
    .from('hubs')
    .select('*', { count: 'exact', head: true });
  console.log(`Preserved hubs: ${hubCount}`);

  console.log('\nActivity reset complete!');
}

resetActivity().catch((err) => {
  console.error('Fatal error during reset:', err);
  process.exit(1);
});
