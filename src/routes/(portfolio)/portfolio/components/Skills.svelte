<script>
    import { skills, qualities } from '../data.js';

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
</script>

<section id="competences" class="section">
    <div class="section-header" use:reveal>
        <span class="kicker">Compétences</span>
        <h2 class="section-title">Stack & expertise technique</h2>
    </div>

    <!-- Skill categories -->
    <div class="skills-grid">
        {#each skills as skill, i}
            <article class="skill-card card" use:reveal style="--delay: {i * 100}ms">
                <div class="card-icon" aria-hidden="true">{skill.icon}</div>
                <h3 class="card-title">{skill.title}</h3>
                <p class="card-desc">{skill.description}</p>

                <div class="chips">
                    {#each skill.items as item}
                        <span class="chip">{item}</span>
                    {/each}
                </div>
            </article>
        {/each}
    </div>

    <!-- Qualités -->
    <div class="qualities-wrap" use:reveal style="--delay: 200ms">
        <h3 class="sub-title">Méthode & approche</h3>
        <div class="qualities-grid">
            {#each qualities as q, i}
                <div class="quality-item card" use:reveal style="--delay: {i * 80 + 300}ms">
                    <span class="q-icon" aria-hidden="true">{q.icon}</span>
                    <div>
                        <div class="q-title">{q.title}</div>
                        <p class="q-text">{q.text}</p>
                    </div>
                </div>
            {/each}
        </div>
    </div>
</section>

<style>
    .section {
        max-width: 1200px;
        margin: 0 auto;
        padding: 5rem 1.5rem;
    }

    .section-header {
        margin-bottom: 2.5rem;
    }

    .kicker {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #8b5cf6;
        margin-bottom: 0.7rem;
    }

    .section-title {
        margin: 0;
        font-size: clamp(1.8rem, 4vw, 2.4rem);
        letter-spacing: -0.04em;
        color: #f1f5f9;
        font-weight: 800;
    }

    .skills-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        margin-bottom: 3.5rem;
    }

    .card {
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(12px);
        transition: border-color 0.3s, transform 0.3s;
    }

    .skill-card {
        padding: 1.6rem;
    }

    .skill-card:hover {
        border-color: rgba(139, 92, 246, 0.2);
        transform: translateY(-3px);
    }

    .card-icon {
        font-size: 1.4rem;
        margin-bottom: 0.9rem;
        opacity: 0.7;
    }

    .card-title {
        margin: 0 0 0.5rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: #e2e8f0;
        letter-spacing: -0.02em;
    }

    .card-desc {
        margin: 0 0 1.2rem;
        font-size: 0.88rem;
        line-height: 1.7;
        color: #64748b;
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .chip {
        padding: 0.3rem 0.65rem;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 500;
        background: rgba(139, 92, 246, 0.08);
        border: 1px solid rgba(139, 92, 246, 0.14);
        color: #c4b5fd;
    }

    /* Qualités */
    .qualities-wrap {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 2.5rem;
    }

    .sub-title {
        margin: 0 0 1.5rem;
        font-size: 1.2rem;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: -0.02em;
    }

    .qualities-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.8rem;
    }

    .quality-item {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
        padding: 1.2rem 1.4rem;
    }

    .quality-item:hover {
        border-color: rgba(139, 92, 246, 0.15);
    }

    .q-icon {
        flex-shrink: 0;
        font-size: 1rem;
        opacity: 0.5;
        margin-top: 0.1rem;
    }

    .q-title {
        font-size: 0.97rem;
        font-weight: 700;
        color: #cbd5e1;
        margin-bottom: 0.35rem;
    }

    .q-text {
        margin: 0;
        font-size: 0.87rem;
        line-height: 1.7;
        color: #64748b;
    }

    @media (max-width: 900px) {
        .skills-grid {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 640px) {
        .qualities-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
