<script>
    import { onMount } from 'svelte';
    import { GITHUB_URL, LINKEDIN_URL, metrics } from '../data.js';

    let countersStarted = false;
    let displayValues = metrics.map(() => 0);

    const words = ['Web', 'Application', 'Performance', 'Automatisation'];
    let wordIndex = 0;
    let displayed = '';
    let isDeleting = false;
    let typeInterval;

    function reveal(node) {
        node.classList.add('reveal');
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        node.classList.add('visible');
                        observer.unobserve(node);
                    }
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(node);
        return { destroy() { observer.disconnect(); } };
    }

    function animateCounter(index, target) {
        const duration = 1800;
        const steps = 60;
        const step = target / steps;
        let current = 0;
        const interval = setInterval(() => {
            current += step;
            if (current >= target) {
                displayValues[index] = target;
                clearInterval(interval);
            } else {
                displayValues[index] = Math.floor(current);
            }
        }, duration / steps);
    }

    function startCounters(node) {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && !countersStarted) {
                        countersStarted = true;
                        metrics.forEach((m, i) => animateCounter(i, m.value));
                        observer.disconnect();
                    }
                }
            },
            { threshold: 0.3 }
        );
        observer.observe(node);
        return { destroy() { observer.disconnect(); } };
    }

    function typewriter() {
        const current = words[wordIndex];
        if (!isDeleting) {
            displayed = current.slice(0, displayed.length + 1);
            if (displayed === current) {
                clearInterval(typeInterval);
                setTimeout(() => {
                    isDeleting = true;
                    typeInterval = setInterval(typewriter, 60);
                }, 1800);
                return;
            }
        } else {
            displayed = current.slice(0, displayed.length - 1);
            if (displayed === '') {
                isDeleting = false;
                wordIndex = (wordIndex + 1) % words.length;
                clearInterval(typeInterval);
                setTimeout(() => {
                    typeInterval = setInterval(typewriter, 95);
                }, 300);
                return;
            }
        }
    }

    onMount(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduced) {
            displayed = words[0];
            setTimeout(() => {
                typeInterval = setInterval(typewriter, 95);
            }, 2000);
        } else {
            displayed = words[0];
        }
        return () => clearInterval(typeInterval);
    });
</script>

<section id="top" class="hero-section">
    <div class="hero-content" use:reveal>
        <div class="status-badge">
            <span class="ping"></span>
            Alternant · Licence Générale STS · 2025–2026
        </div>

        <p class="eyebrow">Portfolio · 2026</p>

        <h1 class="hero-name">
            Théo<br/>Foucher
        </h1>

        <h2 class="hero-sub">
            Développeur <span class="typewriter" aria-live="polite">{displayed}<span class="cursor">|</span></span>
        </h2>

        <p class="hero-desc">
            J'aime comprendre la mécanique des choses et concevoir des outils utiles, rapides et élégants.
            Entre interfaces modernes, logique métier et analyse de données - je cherche toujours la trajectoire la plus propre.
        </p>

        <div class="cta-row">
            <a href="#projets" class="btn-primary">
                Voir mes projets
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <a href="#contact" class="btn-ghost">Me contacter</a>
        </div>

        <div class="socials">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" class="social-chip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.09.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
                GitHub
            </a>
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" class="social-chip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                LinkedIn
            </a>
        </div>
    </div>

    <div class="hero-panels" use:startCounters>
        <div class="panel-grid">
            <!-- Métriques -->
            <div class="panel metric-panel glass-card">
                <div class="metrics-row">
                    {#each metrics as metric, i}
                        <div class="metric">
                            <div class="metric-value">{displayValues[i]}{metric.suffix}</div>
                            <div class="metric-label">{metric.label}</div>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Focus card -->
            <div class="panel focus-panel glass-card">
                <div class="panel-label">Focus actuel</div>
                <p class="focus-text">Transformer les besoins réels en outils clairs, fiables et performants.</p>
                <div class="stack-chips">
                    <span>SvelteKit (perso)</span>
                    <span>Supabase (perso)</span>
                    <span>Python (alternance)</span>
                    <span>Automatisation (alternance)</span>
                    <span>Data (alternance)</span>
                    <span>Excel (alternance)</span>
                </div>
            </div>

            <!-- Dispo card -->
            <div class="panel dispo-panel glass-card">
                <div class="dispo-dot"></div>
                <div>
                    <div class="dispo-title">En alternance — Licence Générale STS</div>
                    <div class="dispo-sub">En recherche pour 2026–2027</div>
                </div>
            </div>
        </div>
    </div>
</section>

<style>
    .hero-section {
        min-height: calc(100vh - 58px);
        max-width: 1200px;
        margin: 0 auto;
        padding: 7rem 1.5rem 4rem;
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        align-items: center;
        gap: 3rem;
    }

    /* Reveal animation */
    :global(.reveal) {
        opacity: 0;
        transform: translateY(28px);
        transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        transition-delay: var(--delay, 0ms);
    }
    :global(.reveal.visible) {
        opacity: 1;
        transform: translateY(0);
    }

    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.45rem 0.9rem;
        border-radius: 999px;
        background: rgba(99, 102, 241, 0.08);
        border: 1px solid rgba(99, 102, 241, 0.2);
        color: #c7d2fe;
        font-size: 0.82rem;
        font-weight: 500;
        margin-bottom: 1.2rem;
    }

    .ping {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6366f1;
        box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.5);
        animation: ping 2s infinite;
    }

    @keyframes ping {
        0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.5); }
        70% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
        100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
    }

    .eyebrow {
        margin: 0 0 0.6rem;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6366f1;
    }

    .hero-name {
        margin: 0;
        font-size: clamp(3.8rem, 9vw, 7rem);
        line-height: 0.92;
        letter-spacing: -0.055em;
        background: linear-gradient(135deg, #ffffff 0%, #e0e7ff 30%, #c4b5fd 65%, #67e8f9 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .hero-sub {
        margin: 1rem 0 0;
        font-size: clamp(1.2rem, 2.8vw, 1.9rem);
        font-weight: 500;
        color: #94a3b8;
        line-height: 1.3;
    }

    .typewriter {
        color: #a5b4fc;
        font-weight: 700;
    }

    .cursor {
        animation: blink 1s step-end infinite;
        opacity: 1;
        color: #6366f1;
    }

    @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
    }

    .hero-desc {
        margin: 1.4rem 0 0;
        max-width: 560px;
        font-size: 1.05rem;
        line-height: 1.85;
        color: #64748b;
    }

    .cta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.8rem;
    }

    .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.85rem 1.4rem;
        border-radius: 12px;
        font-weight: 700;
        font-size: 0.95rem;
        text-decoration: none;
        color: #030712;
        background: linear-gradient(135deg, #818cf8, #6366f1 50%, #4f46e5);
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.5), 0 8px 24px rgba(99, 102, 241, 0.25);
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.6), 0 12px 32px rgba(99, 102, 241, 0.35);
    }

    .btn-ghost {
        display: inline-flex;
        align-items: center;
        padding: 0.85rem 1.4rem;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.95rem;
        text-decoration: none;
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.03);
        transition: color 0.2s, border-color 0.2s, background 0.2s;
    }

    .btn-ghost:hover {
        color: #f1f5f9;
        border-color: rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.06);
    }

    .socials {
        display: flex;
        gap: 0.6rem;
        margin-top: 1.4rem;
        flex-wrap: wrap;
    }

    .social-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.5rem 0.9rem;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        color: #94a3b8;
        font-size: 0.85rem;
        font-weight: 500;
        text-decoration: none;
        transition: color 0.2s, border-color 0.2s;
    }

    .social-chip:hover {
        color: #f1f5f9;
        border-color: rgba(255, 255, 255, 0.16);
    }

    /* Panels right side */
    .panel-grid {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }

    .glass-card {
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        padding: 1.5rem;
        transition: border-color 0.3s, transform 0.3s;
    }

    .glass-card:hover {
        border-color: rgba(99, 102, 241, 0.18);
        transform: translateY(-2px);
    }

    .metrics-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
    }

    .metric-value {
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: -0.04em;
        background: linear-gradient(135deg, #e0e7ff, #a5b4fc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .metric-label {
        margin-top: 0.2rem;
        font-size: 0.78rem;
        line-height: 1.4;
        color: #475569;
    }

    .panel-label {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #6366f1;
        margin-bottom: 0.7rem;
    }

    .focus-text {
        margin: 0 0 1rem;
        font-size: 1rem;
        line-height: 1.6;
        color: #cbd5e1;
    }

    .stack-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .stack-chips span {
        padding: 0.3rem 0.7rem;
        border-radius: 6px;
        background: rgba(99, 102, 241, 0.08);
        border: 1px solid rgba(99, 102, 241, 0.14);
        color: #a5b4fc;
        font-size: 0.78rem;
        font-weight: 500;
    }

    .dispo-panel {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.5rem;
    }

    .dispo-dot {
        flex-shrink: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
        animation: ping-green 2.5s infinite;
    }

    @keyframes ping-green {
        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
        70% { box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .dispo-title {
        font-weight: 700;
        color: #e2e8f0;
        font-size: 0.95rem;
    }

    .dispo-sub {
        font-size: 0.8rem;
        color: #64748b;
        margin-top: 0.15rem;
    }

    @media (max-width: 980px) {
        .hero-section {
            grid-template-columns: 1fr;
            min-height: auto;
            padding-top: 6rem;
        }
    }

    @media (max-width: 640px) {
        .hero-section {
            padding: 5rem 1rem 3rem;
        }

        .hero-desc {
            font-size: 0.95rem;
        }

        .cta-row {
            flex-direction: column;
        }

        .btn-primary,
        .btn-ghost {
            width: 100%;
            justify-content: center;
        }

        .metrics-row {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.25rem;
        }

        .metric-value {
            font-size: 1.5rem;
        }

        .metric-label {
            font-size: 0.7rem;
        }

        .glass-card {
            padding: 1.2rem;
        }

        .stack-chips span {
            font-size: 0.72rem;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .ping, .cursor, .dispo-dot {
            animation: none !important;
        }
        :global(.reveal) {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
        }
    }
</style>
