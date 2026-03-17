<script>
    import { enhance } from '$app/forms';
    import { onMount } from 'svelte';

    export let form;

    const GITHUB_URL = 'https://github.com/Tfoucher5';
    const LINKEDIN_URL = 'https://www.linkedin.com/in/theo-foucher-3956b52a0/';

    let isSubmitting = false;
    let ticking = false;
    let reducedMotion = false;

    const socials = [
        {
            label: 'GitHub',
            url: GITHUB_URL,
            variant: 'primary'
        },
        {
            label: 'LinkedIn',
            url: LINKEDIN_URL,
            variant: 'secondary'
        }
    ];

    const experiences = [
        {
            title: 'Alternance · Dév & Data Industrielle',
            date: 'Actuellement',
            company: 'DAHER LOGISTICS · Montoir-de-Bretagne',
            description:
                "Développement from scratch d’un outil Python pour le suivi des mallettes Kardex et optimisation de flux industriels. Maintenance d’outils métiers lourds en VBA / Access, avec une logique claire de ROI, de fiabilité et d’amélioration continue."
        },
        {
            title: 'Stage · Refonte d’outil Web',
            date: '2024',
            company: 'WIKLOG · La Baule',
            description:
                "Transformation d’un Excel en application Web fluide, responsive et mobile-first avec Laravel. Travail en méthode Agile, focus sur la lisibilité, la performance et la logique métier."
        },
        {
            title: 'Stage · La Poste',
            date: '2023',
            company: 'La Poste · Nantes',
            description:
                "Transformation d’un outil Excel en application Web fluide, responsive avec Angular (Front) et NodeJS (Back)."
        }
    ];

    const skills = [
        {
            title: 'Front-end',
            description:
                'Création d’interfaces modernes, rapides et responsive, avec une attention particulière au ressenti utilisateur.',
            items: ['SvelteKit', 'JavaScript', 'HTML', 'CSS', 'Responsive UI', 'UX fluide']
        },
        {
            title: 'Back-end & Data',
            description:
                'Conception d’applications orientées données, logique métier, persistance, automatisation et exploitation technique.',
            items: ['Laravel', 'PostgreSQL', 'Supabase', 'Python', 'Pandas', 'SQL']
        },
        {
            title: 'Industrialisation',
            description:
                'Développement d’outils pragmatiques pour des environnements réels : logistique, process métier, optimisation, suivi.',
            items: ['Excel', 'VBA', 'Access', 'Process', 'Automatisation', 'Analyse']
        }
    ];

    const qualities = [
        {
            title: 'Rigueur technique',
            text: 'J’aime comprendre la mécanique d’un système avant de l’améliorer. Je vise des solutions propres, stables et maintenables.'
        },
        {
            title: 'Esprit d’analyse',
            text: 'Je cherche la cause racine, la cohérence métier et le meilleur compromis entre simplicité, fiabilité et performance.'
        },
        {
            title: 'Autonomie',
            text: 'Je peux partir d’un besoin métier, clarifier le problème, structurer la solution et livrer quelque chose d’exploitable.'
        },
        {
            title: 'Vision produit',
            text: 'Je pense usage concret, lisibilité, ergonomie, vitesse et valeur réelle.'
        }
    ];

    const projects = [
        {
            title: 'Zik-Music.fr',
            description:
                'Projet personnel majeur : architecture moderne avec SvelteKit, base de données Supabase, logique temps réel et expérience utilisateur travaillée.',
            tags: ['SvelteKit', 'Supabase', 'PostgreSQL', 'Temps réel'],
            link: ['https://github.com/Tfoucher5/ZIK', 'https://www.zik-music.fr'],
            linkLabel: ['Voir le code', 'Voir le site']
        },
        {
            title: 'Moteur de Tracking Kardex',
            description:
                'Outil interne orienté data pour le suivi des pièces, l’optimisation de cycle de vie et la réduction des pertes.',
            tags: ['Python', 'Pandas', 'Automatisation', 'Analyse'],
            internal: true
        },
        {
            title: 'Refonte Outil Logistique Web',
            description:
                'Passage d’une logique tableur à une application Web claire, responsive et exploitable au quotidien.',
            tags: ['Laravel', 'UX', 'Métier', 'Mobile-first']
        }
    ];

    const passions = [
        {
            title: 'Motorsport & Sim Racing',
            text: "Passionné d’endurance, de F1 et de philosophie mécanique. L’optimisation, la trajectoire et la précision me parlent autant sur piste qu’en développement."
        },
        {
            title: 'Gaming & univers sandbox',
            text: 'J’apprécie les systèmes complexes, l’expérimentation et les environnements où performance et créativité cohabitent.'
        }
    ];

    const metrics = [
        { value: '3+', label: 'univers techniques croisés' },
        { value: '1', label: 'fil conducteur : performance' },
        { value: '∞', label: 'envie d’itérer et d’optimiser' }
    ];

    const handleEnhance = () => {
        isSubmitting = true;

        return async ({ result, update }) => {
            await update({ reset: result.type === 'success' });
            isSubmitting = false;
        };
    };

    function reveal(node) {
        if (reducedMotion) {
            node.classList.add('visible');
            return {
                destroy() {}
            };
        }

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
            { threshold: 0.14 }
        );

        observer.observe(node);

        return {
            destroy() {
                observer.disconnect();
            }
        };
    }

    const handleMouseMove = (event) => {
        if (ticking || reducedMotion) return;
        ticking = true;

        requestAnimationFrame(() => {
            const cards = document.querySelectorAll('.glow-card');

            for (const card of cards) {
                const rect = card.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            }

            ticking = false;
        });
    };

    onMount(() => {
        reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });
</script>

<svelte:head>
    <title>Théo Foucher | Développement Web · Data · Optimisation</title>
    <meta
        name="description"
        content="Portfolio de Théo Foucher — développement web, data, automatisation, optimisation industrielle et interfaces modernes."
    />
</svelte:head>

<main class="portfolio-shell" on:mousemove={handleMouseMove}>
    <div class="background-layer" aria-hidden="true">
        <div class="orb orb-a"></div>
        <div class="orb orb-b"></div>
        <div class="orb orb-c"></div>
        <div class="grid-noise"></div>
    </div>

    <header class="glass-header">
        <nav class="nav">
            <a href="#top" class="brand" aria-label="Retour en haut">
                <span class="brand-mark">TF</span>
                <span class="brand-dot"></span>
            </a>

            <div class="nav-links">
                <a href="#parcours">Parcours</a>
                <a href="#competences">Compétences</a>
                <a href="#projets">Projets</a>
                <a href="#qualites">Qualités</a>
                <a href="#contact">Contact</a>
            </div>
        </nav>
    </header>

    <section id="top" class="hero section">
        <div class="hero-copy" use:reveal>
            <div class="status-badge">
                <span class="status-ping"></span>
                Étudiant · Alternant · Développement & Data
            </div>

            <p class="eyebrow">Portfolio</p>
            <h1 class="hero-title">
                Théo Foucher
            </h1>
            <h2 class="hero-subtitle">
                Développeur Web · Automatisation ·
                <span class="accent-text">Optimisation Data</span>
            </h2>

            <p class="hero-text">
                J’aime comprendre la mécanique des choses et concevoir des outils utiles, rapides et élégants.
                Entre interfaces modernes, logique métier et analyse de données, je cherche toujours la
                trajectoire la plus propre.
            </p>

            <div class="hero-pills" use:reveal>
                <span class="pill">SvelteKit</span>
                <span class="pill">Laravel</span>
                <span class="pill">Python / Pandas</span>
                <span class="pill">Supabase</span>
                <span class="pill">SQL</span>
                <span class="pill">Optimisation</span>
            </div>

            <div class="cta-group" use:reveal>
                <a href="#projets" class="btn btn-primary">Découvrir mes projets</a>
                <a href="#contact" class="btn btn-secondary">Me contacter</a>
            </div>

            <div class="socials" use:reveal>
                {#each socials as social}
                    <a
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class={`social-btn ${social.variant === 'secondary' ? 'secondary' : ''}`}
                    >
                        {social.label}
                        <span aria-hidden="true">↗</span>
                    </a>
                {/each}
            </div>
        </div>

        <div class="hero-panel glow-card" use:reveal>
            <div class="card-content hero-panel-content">
                <div class="panel-topline">Focus actuel</div>
                <h3>Transformer les besoins réels en outils clairs, fiables et performants.</h3>

                <div class="metrics">
                    {#each metrics as metric}
                        <div class="metric">
                            <div class="metric-value">{metric.value}</div>
                            <div class="metric-label">{metric.label}</div>
                        </div>
                    {/each}
                </div>

                <div class="mini-stack">
                    <div class="mini-chip">UI moderne</div>
                    <div class="mini-chip">Data pipelines</div>
                    <div class="mini-chip">Automatisation</div>
                    <div class="mini-chip">Outils métier</div>
                </div>
            </div>
        </div>
    </section>

    <section id="parcours" class="section">
        <div class="section-heading" use:reveal>
            <p class="section-kicker">Parcours</p>
            <h3 class="section-title">Expériences & progression</h3>
        </div>

        <div class="timeline">
            {#each experiences as item, index}
                <article class="timeline-item glow-card" use:reveal style={`--delay:${index * 120}ms;`}>
                    <div class="card-content">
                        <div class="card-meta">
                            <h4>{item.title}</h4>
                            <span class="date">{item.date}</span>
                        </div>
                        <div class="company">{item.company}</div>
                        <p>{item.description}</p>
                    </div>
                </article>
            {/each}
        </div>
    </section>

    <section id="competences" class="section">
        <div class="section-heading" use:reveal>
            <p class="section-kicker">Compétences</p>
            <h3 class="section-title">Ce que je sais construire</h3>
        </div>

        <div class="skills-grid">
            {#each skills as skill, index}
                <article class="glow-card skill-card" use:reveal style={`--delay:${index * 120}ms;`}>
                    <div class="card-content">
                        <h4>{skill.title}</h4>
                        <p>{skill.description}</p>

                        <div class="chip-list">
                            {#each skill.items as item}
                                <span class="chip">{item}</span>
                            {/each}
                        </div>
                    </div>
                </article>
            {/each}
        </div>
    </section>

    <section id="projets" class="section">
        <div class="section-heading" use:reveal>
            <p class="section-kicker">Projets</p>
            <h3 class="section-title">Sélection technique</h3>
        </div>

        <div class="projects-grid">
            {#each projects as project, index}
                <article class="glow-card project-card" use:reveal style={`--delay:${index * 120}ms;`}>
                    <div class="card-content">
                        <div class="tag-row">
                            {#each project.tags as tag}
                                <span class="tag">{tag}</span>
                            {/each}
                        </div>

                        <h4>{project.title}</h4>
                        <p>{project.description}</p>

                        {#if project.link}
                            {#each project.link as link}
                                    <a
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="project-link"
                                    >
                                        {#if link == "https://www.zik-music.fr"} zik-music.fr {:else} Voir le code {/if}<span aria-hidden="true">→</span>
                                    </a>
                            {/each}
                        {:else if project.internal}
                            <span class="internal-badge">Projet interne · confidentiel</span>
                        {/if}
                    </div>
                </article>
            {/each}
        </div>
    </section>

    <section id="qualites" class="section">
        <div class="section-heading" use:reveal>
            <p class="section-kicker">Qualités</p>
            <h3 class="section-title">Ma manière de travailler</h3>
        </div>

        <div class="qualities-grid">
            {#each qualities as quality, index}
                <article class="glow-card" use:reveal style={`--delay:${index * 100}ms;`}>
                    <div class="card-content">
                        <h4>{quality.title}</h4>
                        <p>{quality.text}</p>
                    </div>
                </article>
            {/each}
        </div>
    </section>

    <section class="section">
        <div class="section-heading" use:reveal>
            <p class="section-kicker">Au-delà du code</p>
            <h3 class="section-title">Performance, systèmes & passions</h3>
        </div>

        <article class="glow-card" use:reveal>
            <div class="card-content">
                <h4>Ce qui m’anime</h4>
                <div class="passion-list">
                    {#each passions as passion}
                        <div class="passion-item">
                            <h5>{passion.title}</h5>
                            <p>{passion.text}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </article>
    </section>

    <section id="contact" class="section">
        <div class="section-heading" use:reveal>
            <p class="section-kicker">Contact</p>
            <h3 class="section-title">Initialiser une connexion</h3>
        </div>

        <div class="contact-wrap">
            <div class="glow-card contact-card" use:reveal>
                <div class="card-content">
                    <p class="contact-intro">
                        Un projet, une alternance, une opportunité ou simplement un échange ? Écris-moi ici.
                    </p>

                    <form method="POST" use:enhance={handleEnhance} class="contact-form">
                        <!-- honeypot anti-spam -->
                        <div class="hidden-field" aria-hidden="true">
                            <label for="website">Website</label>
                            <input id="website" name="website" type="text" tabindex="-1" autocomplete="off" />
                        </div>

                        <div class="input-group">
                            <input
                                id="nom"
                                type="text"
                                name="nom"
                                placeholder=" "
                                required
                                disabled={isSubmitting}
                                value={form?.values?.nom ?? ''}
                            />
                            <label for="nom">Votre nom</label>
                        </div>

                        <div class="input-group">
                            <input
                                id="email"
                                type="email"
                                name="email"
                                placeholder=" "
                                required
                                disabled={isSubmitting}
                                value={form?.values?.email ?? ''}
                            />
                            <label for="email">Votre email</label>
                        </div>

                        <div class="input-group">
                            <textarea
                                id="message"
                                name="message"
                                placeholder=" "
                                rows="6"
                                required
                                disabled={isSubmitting}
                            >{form?.values?.message ?? ''}</textarea>
                            <label for="message">Votre message</label>
                        </div>

                        <button class="btn btn-primary submit-btn" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Transmission...' : 'Envoyer le message'}
                        </button>
                    </form>

                    {#if form?.success}
                        <div class="status success">
                            {form.message}
                        </div>
                    {:else if form?.error}
                        <div class="status error">
                            {form.error}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </section>
</main>

<style>
    :global(html) {
        scroll-behavior: smooth;
    }

    .portfolio-shell {
        --bg-0: #050816;
        --bg-1: #0a1020;
        --bg-2: #0f172a;
        --surface: rgba(15, 23, 42, 0.7);
        --surface-2: rgba(17, 24, 39, 0.78);
        --surface-3: rgba(25, 34, 54, 0.88);
        --border: rgba(255, 255, 255, 0.08);
        --border-strong: rgba(255, 255, 255, 0.14);
        --text-main: #eef2ff;
        --text-soft: #cbd5e1;
        --text-muted: #94a3b8;
        --accent: #60a5fa;
        --accent-2: #8b5cf6;
        --accent-3: #22d3ee;
        --accent-warm: #f59e0b;
        --accent-glow: rgba(96, 165, 250, 0.2);
        --accent-2-glow: rgba(139, 92, 246, 0.18);
        --accent-3-glow: rgba(34, 211, 238, 0.14);

        position: relative;
        min-height: 100vh;
        color: var(--text-main);
        background:
            radial-gradient(circle at 12% 18%, rgba(139, 92, 246, 0.16), transparent 24%),
            radial-gradient(circle at 86% 14%, rgba(96, 165, 250, 0.16), transparent 28%),
            radial-gradient(circle at 76% 70%, rgba(34, 211, 238, 0.12), transparent 22%),
            linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 45%, var(--bg-2) 100%);
        overflow-x: clip;
    }

    .background-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
    }

    .orb {
        position: absolute;
        border-radius: 999px;
        filter: blur(75px);
        opacity: 0.75;
        will-change: transform;
        animation: floatOrb 14s ease-in-out infinite;
    }

    .orb-a {
        width: 340px;
        height: 340px;
        top: 7%;
        left: -80px;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, transparent 68%);
    }

    .orb-b {
        width: 420px;
        height: 420px;
        top: 12%;
        right: -110px;
        background: radial-gradient(circle, rgba(96, 165, 250, 0.28) 0%, transparent 70%);
        animation-delay: -4s;
    }

    .orb-c {
        width: 300px;
        height: 300px;
        bottom: 8%;
        right: 14%;
        background: radial-gradient(circle, rgba(34, 211, 238, 0.2) 0%, transparent 68%);
        animation-delay: -8s;
    }

    .grid-noise {
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
        background-size: 34px 34px;
        mask-image: radial-gradient(circle at center, black 42%, transparent 90%);
        opacity: 0.45;
    }

    .glass-header {
        position: sticky;
        top: 0;
        z-index: 20;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        background: linear-gradient(180deg, rgba(5, 8, 22, 0.78), rgba(5, 8, 22, 0.52));
        border-bottom: 1px solid var(--border);
    }

    .nav {
        position: relative;
        z-index: 1;
        max-width: 1180px;
        margin: 0 auto;
        padding: 1rem 1.4rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }

    .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
        color: var(--text-main);
        font-weight: 800;
        letter-spacing: -0.04em;
    }

    .brand-mark {
        font-size: 1.2rem;
    }

    .brand-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        box-shadow: 0 0 18px rgba(96, 165, 250, 0.55);
    }

    .nav-links {
        display: flex;
        align-items: center;
        gap: 1.1rem;
        flex-wrap: wrap;
    }

    .nav-links a {
        color: var(--text-muted);
        text-decoration: none;
        font-size: 0.94rem;
        font-weight: 500;
        transition:
            color 0.25s ease,
            transform 0.25s ease;
    }

    .nav-links a:hover {
        color: var(--text-main);
        transform: translateY(-1px);
    }

    .section {
        position: relative;
        z-index: 1;
        max-width: 1180px;
        margin: 0 auto;
        padding: 5.5rem 1.4rem;
    }

    .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
        align-items: center;
        gap: 2rem;
        padding-top: 6rem;
        min-height: calc(100vh - 72px);
    }

    .eyebrow,
    .section-kicker,
    .panel-topline {
        margin: 0 0 0.8rem;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #93c5fd;
    }

    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.55rem 0.95rem;
        margin-bottom: 1.1rem;
        border-radius: 999px;
        background: rgba(96, 165, 250, 0.08);
        border: 1px solid rgba(96, 165, 250, 0.16);
        color: #cfe3ff;
        font-size: 0.85rem;
        font-weight: 500;
    }

    .status-ping {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.45);
        animation: pulse 2.1s infinite;
    }

    .hero-title {
        margin: 0;
        font-size: clamp(3.1rem, 8vw, 5.8rem);
        line-height: 0.95;
        letter-spacing: -0.055em;
        background: linear-gradient(135deg, #ffffff 0%, #dbeafe 38%, #c4b5fd 72%, #67e8f9 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
        margin: 0.9rem 0 0;
        font-size: clamp(1.35rem, 3.3vw, 2.35rem);
        line-height: 1.15;
        font-weight: 500;
        color: var(--text-soft);
    }

    .accent-text {
        color: #a5f3fc;
        text-shadow: 0 0 18px rgba(34, 211, 238, 0.18);
    }

    .hero-text {
        max-width: 720px;
        margin: 1.5rem 0 0;
        font-size: 1.08rem;
        line-height: 1.9;
        color: var(--text-muted);
    }

    .hero-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
        margin-top: 1.5rem;
    }

    .pill,
    .chip,
    .tag,
    .mini-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.58rem 0.9rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.035);
        color: var(--text-soft);
        font-size: 0.82rem;
        line-height: 1;
        white-space: nowrap;
    }

    .cta-group {
        display: flex;
        flex-wrap: wrap;
        gap: 0.95rem;
        margin-top: 1.8rem;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        padding: 0.95rem 1.25rem;
        border-radius: 14px;
        text-decoration: none;
        font-weight: 700;
        border: 1px solid transparent;
        transition:
            transform 0.25s ease,
            box-shadow 0.25s ease,
            background 0.25s ease,
            border-color 0.25s ease;
        cursor: pointer;
    }

    .btn:hover {
        transform: translateY(-2px);
    }

    .btn-primary {
        color: #07111f;
        background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 55%, #67e8f9 100%);
        box-shadow: 0 16px 38px rgba(96, 165, 250, 0.18);
    }

    .btn-secondary {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.04);
        border-color: var(--border);
    }

    .socials {
        display: flex;
        flex-wrap: wrap;
        gap: 0.85rem;
        margin-top: 1.45rem;
    }

    .social-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.84rem 1.05rem;
        border-radius: 12px;
        font-weight: 700;
        text-decoration: none;
        color: #07111f;
        background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 55%, #67e8f9 100%);
        box-shadow: 0 14px 34px rgba(96, 165, 250, 0.18);
        transition:
            transform 0.25s ease,
            box-shadow 0.25s ease;
    }

    .social-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 18px 42px rgba(96, 165, 250, 0.24);
    }

    .social-btn.secondary {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--border);
        box-shadow: none;
    }

    .glow-card {
        position: relative;
        border-radius: 24px;
        border: 1px solid var(--border);
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02)),
            var(--surface);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        overflow: hidden;
        transition:
            transform 0.35s ease,
            border-color 0.35s ease,
            box-shadow 0.35s ease;
    }

    .glow-card:hover {
        transform: translateY(-4px);
        border-color: rgba(96, 165, 250, 0.22);
        box-shadow: 0 20px 60px rgba(2, 6, 23, 0.34);
    }

    .glow-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(
            600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(255, 255, 255, 0.09),
            transparent 34%
        );
        opacity: 0;
        transition: opacity 0.35s ease;
        pointer-events: none;
    }

    .glow-card:hover::before {
        opacity: 1;
    }

    .glow-card::after {
        content: '';
        position: absolute;
        inset: 0;
        padding: 1px;
        border-radius: inherit;
        background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.08),
            rgba(96, 165, 250, 0.06),
            rgba(139, 92, 246, 0.08),
            rgba(255, 255, 255, 0.04)
        );
        -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
        opacity: 0.9;
    }

    .card-content {
        position: relative;
        z-index: 1;
        padding: 2rem;
        height: 100%;
    }

    .hero-panel-content h3 {
        margin: 0 0 1rem;
        font-size: 1.4rem;
        line-height: 1.35;
    }

    .metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.9rem;
        margin-top: 1.4rem;
    }

    .metric {
        padding: 1rem;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .metric-value {
        font-size: 1.8rem;
        font-weight: 800;
        letter-spacing: -0.04em;
        color: #dbeafe;
    }

    .metric-label {
        margin-top: 0.3rem;
        font-size: 0.84rem;
        line-height: 1.5;
        color: var(--text-muted);
    }

    .mini-stack {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
        margin-top: 1.3rem;
    }

    .section-heading {
        margin-bottom: 2rem;
    }

    .section-title {
        position: relative;
        margin: 0;
        font-size: clamp(1.9rem, 4.5vw, 2.6rem);
        letter-spacing: -0.04em;
    }

    .section-title::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: -0.85rem;
        width: 78px;
        height: 3px;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-3));
        box-shadow: 0 0 20px rgba(96, 165, 250, 0.2);
    }

    .timeline {
        position: relative;
        display: grid;
        gap: 1.1rem;
        padding-left: 1.2rem;
    }

    .timeline::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0.35rem;
        bottom: 0.35rem;
        width: 2px;
        background: linear-gradient(180deg, rgba(96, 165, 250, 0.34), rgba(139, 92, 246, 0.18));
    }

    .timeline-item {
        position: relative;
        margin-left: 0.8rem;
    }

    .timeline-item::before {
        content: '';
        position: absolute;
        left: -1.55rem;
        top: 2rem;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: radial-gradient(circle, #dbeafe 0%, #60a5fa 55%, #8b5cf6 100%);
        box-shadow: 0 0 0 5px rgba(96, 165, 250, 0.08);
        z-index: 2;
    }

    .card-meta {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.55rem;
    }

    .card-meta h4,
    .skill-card h4,
    .project-card h4,
    .qualities-grid h4{
        margin: 0;
        font-size: 1.18rem;
        letter-spacing: -0.02em;
    }

    .date {
        font-size: 0.8rem;
        color: #93c5fd;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        white-space: nowrap;
    }

    .company {
        margin-bottom: 1rem;
        font-size: 0.95rem;
        color: var(--text-muted);
    }

    .timeline-item p,
    .skill-card p,
    .project-card p,
    .qualities-grid p,
    .passion-item p,
    .contact-intro {
        margin: 0;
        color: var(--text-muted);
        line-height: 1.8;
    }

    .skills-grid,
    .projects-grid,
    .qualities-grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 1rem;
    }

    .skill-card {
        grid-column: span 4;
    }

    .project-card {
        grid-column: span 4;
    }

    .qualities-grid article {
        grid-column: span 6;
    }

    .chip-list,
    .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
        margin-top: 1.15rem;
        margin-bottom: 1rem;
    }

    .tag {
        background: rgba(96, 165, 250, 0.07);
        color: #dbeafe;
        border-color: rgba(96, 165, 250, 0.12);
    }

    .project-link {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: 1.35rem;
        margin-right: 1rem;
        text-decoration: none;
        color: #bfdbfe;
        font-weight: 700;
        transition:
            transform 0.2s ease,
            color 0.2s ease;
    }

    .project-link:hover {
        transform: translateX(3px);
        color: #ffffff;
    }

    .internal-badge {
        display: inline-flex;
        align-items: center;
        margin-top: 1.2rem;
        padding: 0.6rem 0.85rem;
        border-radius: 12px;
        background: rgba(245, 158, 11, 0.09);
        border: 1px solid rgba(245, 158, 11, 0.18);
        color: #fcd34d;
        font-size: 0.82rem;
        font-weight: 700;
    }

    .dual-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
        gap: 1rem;
    }

    .passion-list {
        display: grid;
        gap: 1rem;
        margin-top: 1rem;
    }

    .passion-item {
        padding: 1rem 1rem 0;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .passion-item:first-child {
        padding-top: 0;
        border-top: 0;
    }

    .passion-item h5 {
        margin: 0 0 0.45rem;
        font-size: 1rem;
        color: var(--text-main);
    }

    .contact-wrap {
        display: flex;
        justify-content: center;
    }

    .contact-card {
        width: 100%;
        max-width: 760px;
    }

    .contact-form {
        margin-top: 1.3rem;
    }

    .hidden-field {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
        opacity: 0;
    }

    .input-group {
        position: relative;
        margin-bottom: 1.45rem;
    }

    .input-group input,
    .input-group textarea {
        width: 100%;
        padding: 1.2rem 0.95rem 0.8rem;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.03);
        color: var(--text-main);
        font: inherit;
        transition:
            border-color 0.25s ease,
            background 0.25s ease,
            box-shadow 0.25s ease;
        resize: vertical;
    }

    .input-group input:focus,
    .input-group textarea:focus {
        outline: none;
        border-color: rgba(96, 165, 250, 0.42);
        background: rgba(255, 255, 255, 0.045);
        box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.08);
    }

    .input-group label {
        position: absolute;
        left: 0.95rem;
        top: 1rem;
        font-size: 0.95rem;
        color: var(--text-muted);
        pointer-events: none;
        transition:
            transform 0.2s ease,
            top 0.2s ease,
            font-size 0.2s ease,
            color 0.2s ease;
    }

    .input-group input:focus ~ label,
    .input-group input:not(:placeholder-shown) ~ label,
    .input-group textarea:focus ~ label,
    .input-group textarea:not(:placeholder-shown) ~ label {
        top: 0.46rem;
        font-size: 0.76rem;
        transform: translateY(0);
        color: #bfdbfe;
    }

    .submit-btn {
        width: 100%;
        margin-top: 0.7rem;
    }

    .status {
        margin-top: 1.2rem;
        padding: 0.95rem 1rem;
        border-radius: 14px;
        font-weight: 600;
        text-align: center;
    }

    .status.success {
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.22);
        color: #86efac;
    }

    .status.error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: #fda4af;
    }

    :global(.portfolio-shell .reveal) {
        opacity: 0;
        transform: translateY(24px) scale(0.985);
        transition:
            opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        transition-delay: var(--delay, 0ms);
        will-change: transform, opacity;
    }

    :global(.portfolio-shell .reveal.visible) {
        opacity: 1;
        transform: translateY(0) scale(1);
    }

    @keyframes pulse {
        0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.45);
        }
        70% {
            transform: scale(1);
            box-shadow: 0 0 0 9px rgba(96, 165, 250, 0);
        }
        100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(96, 165, 250, 0);
        }
    }

    @keyframes floatOrb {
        0%,
        100% {
            transform: translate3d(0, 0, 0) scale(1);
        }
        50% {
            transform: translate3d(16px, 18px, 0) scale(1.04);
        }
    }

    @media (max-width: 980px) {
        .hero {
            grid-template-columns: 1fr;
            min-height: auto;
            padding-top: 5rem;
        }

        .skill-card,
        .project-card,
        .qualities-grid article {
            grid-column: span 12;
        }

        .dual-grid {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 720px) {
        .nav {
            padding: 0.95rem 1rem;
        }

        .nav-links {
            display: none;
        }

        .section {
            padding: 4.5rem 1rem;
        }

        .card-content {
            padding: 1.3rem;
        }

        .metrics {
            grid-template-columns: 1fr;
        }

        .card-meta {
            flex-direction: column;
            align-items: flex-start;
        }

        .timeline-item::before {
            top: 1.4rem;
        }

        .socials,
        .cta-group {
            flex-direction: column;
            align-items: stretch;
        }

        .social-btn,
        .btn {
            width: 100%;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .orb,
        .status-ping,
        .glow-card,
        .btn,
        .social-btn,
        .nav-links a,
        .project-link {
            animation: none !important;
            transition: none !important;
        }
    }
</style>