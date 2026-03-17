<script>
    import { onMount } from 'svelte';

    onMount(() => {
        document.body.classList.add('portfolio-mode');

        return () => {
            document.body.classList.remove('portfolio-mode');
        };
    });
</script>

<slot />

<style>
    :global(html) {
        background: #050816;
    }

    :global(body.portfolio-mode) {
        margin: 0;
        padding: 0;
        min-height: 100vh;
        background: #050816;
        color: #eef2ff;
        font-family:
            'Inter',
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
    }

    :global(body.portfolio-mode *) {
        box-sizing: border-box;
    }

    :global(body.portfolio-mode a) {
        -webkit-tap-highlight-color: transparent;
    }

    :global(body.portfolio-mode #svelte) {
        min-height: 100vh;
    }

    :global(body.portfolio-mode ::selection) {
        background: rgba(96, 165, 250, 0.25);
        color: #ffffff;
    }
</style>