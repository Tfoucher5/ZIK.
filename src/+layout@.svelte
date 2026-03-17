<script>
	// Ce layout "reset" empêche le design de zik-music.fr 
	// de baver sur le portfolio.
</script>

<slot />

<style>
	/* On s'assure que le body prend bien le dark mode de base 
	   au cas où ton app.html global forcerait un fond blanc */
	:global(body) {
		margin: 0;
		padding: 0;
		background-color: #0f172a; /* Le fond Dark Mode */
	}
</style>