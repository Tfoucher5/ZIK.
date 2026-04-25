<script>
  let { children } = $props();
</script>

<svelte:head>
  <link rel="stylesheet" href="/css/salon.css?v=2.1.1">
</svelte:head>

{@render children()}
