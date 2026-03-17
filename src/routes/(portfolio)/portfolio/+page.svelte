<script>
    import { onMount } from 'svelte';

    import PortfolioNav from './components/PortfolioNav.svelte';
    import Hero from './components/Hero.svelte';
    import TechMarquee from './components/TechMarquee.svelte';
    import Experience from './components/Experience.svelte';
    import Education from './components/Education.svelte';
    import Skills from './components/Skills.svelte';
    import Projects from './components/Projects.svelte';
    import Passions from './components/Passions.svelte';
    import Contact from './components/Contact.svelte';

    export let form;

    let ticking = false;

    // Glow effect sur toutes les cartes
    function handleMouseMove(e) {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const cards = document.querySelectorAll('.glow-target');
            for (const card of cards) {
                const rect = card.getBoundingClientRect();
                card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            }
            ticking = false;
        });
    }

    onMount(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduced) {
            window.addEventListener('mousemove', handleMouseMove, { passive: true });
        }
        return () => window.removeEventListener('mousemove', handleMouseMove);
    });
</script>

<svelte:head>
    <title>Théo Foucher | Développeur Web · Data · Optimisation</title>
    <meta
        name="description"
        content="Portfolio de Théo Foucher — développement web full-stack, data, automatisation industrielle et interfaces modernes."
    />
    <meta name="theme-color" content="#030712" />
</svelte:head>

<div class="portfolio">
    <!-- Background aurora animé -->
    <div class="bg-layer" aria-hidden="true">
        <div class="aurora aurora-1"></div>
        <div class="aurora aurora-2"></div>
        <div class="aurora aurora-3"></div>
        <div class="grid-overlay"></div>
    </div>

    <PortfolioNav />

    <main>
        <Hero />
        <TechMarquee />
        <Experience />
        <Education />
        <Skills />
        <Projects />
        <Passions />
        <Contact {form} />
    </main>

    <footer class="footer">
        <div class="footer-inner">
            <span>Théo Foucher · {new Date().getFullYear()}</span>
            <span class="footer-sep" aria-hidden="true">·</span>
            <span>Développé avec SvelteKit</span>
        </div>
    </footer>
</div>

<style>
    :global(html) {
        scroll-behavior: smooth;
    }

    /* ── Reveal animation (partagé entre tous les composants) ── */
    :global(.reveal) {
        opacity: 0;
        transform: translateY(28px);
        transition:
            opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        transition-delay: var(--delay, 0ms);
        will-change: transform, opacity;
    }

    :global(.reveal.visible) {
        opacity: 1;
        transform: translateY(0);
    }

    @media (prefers-reduced-motion: reduce) {
        :global(.reveal) {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
        }
        .aurora {
            animation: none !important;
        }
    }

    /* ── Base ── */
    .portfolio {
        position: relative;
        min-height: 100vh;
        color: #f1f5f9;
        background: #030712;
        overflow-x: clip;
    }

    /* ── Background ── */
    .bg-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
    }

    .aurora {
        position: absolute;
        border-radius: 999px;
        filter: blur(80px);
        opacity: 0.55;
        will-change: transform;
    }

    .aurora-1 {
        width: 500px;
        height: 500px;
        top: -120px;
        left: -100px;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 65%);
        animation: float1 18s ease-in-out infinite;
    }

    .aurora-2 {
        width: 600px;
        height: 600px;
        top: 0;
        right: -150px;
        background: radial-gradient(circle, rgba(6, 182, 212, 0.28) 0%, transparent 65%);
        animation: float2 22s ease-in-out infinite;
    }

    .aurora-3 {
        width: 420px;
        height: 420px;
        bottom: 10%;
        left: 30%;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.22) 0%, transparent 65%);
        animation: float3 16s ease-in-out infinite;
    }

    @keyframes float1 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(40px, 30px) scale(1.06); }
        66% { transform: translate(-20px, 50px) scale(0.96); }
    }

    @keyframes float2 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        40% { transform: translate(-50px, 40px) scale(1.08); }
        80% { transform: translate(20px, -30px) scale(0.94); }
    }

    @keyframes float3 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(30px, -40px) scale(1.05); }
    }

    .grid-overlay {
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(rgba(255, 255, 255, 0.016) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.016) 1px, transparent 1px);
        background-size: 40px 40px;
        mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
    }

    /* ── Main content (above background) ── */
    main {
        position: relative;
        z-index: 1;
    }

    /* ── Footer ── */
    .footer {
        position: relative;
        z-index: 1;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        padding: 1.5rem;
    }

    .footer-inner {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.82rem;
        color: #334155;
    }

    .footer-sep {
        opacity: 0.4;
    }
</style>
