<script>
    import { passions } from '../data.js';

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

<section class="section">
    <div class="section-header" use:reveal>
        <span class="kicker">Au-delà du code</span>
        <h2 class="section-title">Intérêts & passions</h2>
    </div>

    <div class="passions-grid">
        {#each passions as passion, i}
            <article class="passion-card card" use:reveal style="--delay: {i * 120}ms">
                <div class="passion-inner">
                    <div class="passion-icon" aria-hidden="true">{passion.icon}</div>
                    <h3 class="passion-title">{passion.title}</h3>
                    <p class="passion-text">{passion.text}</p>
                </div>
                <div class="card-blur" aria-hidden="true"></div>
            </article>
        {/each}
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
        color: #f59e0b;
        margin-bottom: 0.7rem;
    }

    .section-title {
        margin: 0;
        font-size: clamp(1.8rem, 4vw, 2.4rem);
        letter-spacing: -0.04em;
        color: #f1f5f9;
        font-weight: 800;
    }

    .passions-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        max-width: 800px;
    }

    .card {
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(12px);
        overflow: hidden;
        position: relative;
        transition: border-color 0.3s, transform 0.3s;
    }

    .card:hover {
        border-color: rgba(245, 158, 11, 0.2);
        transform: translateY(-3px);
    }

    .passion-inner {
        position: relative;
        z-index: 1;
        padding: 2rem;
    }

    .passion-icon {
        font-size: 1.8rem;
        opacity: 0.4;
        margin-bottom: 1rem;
        display: block;
    }

    .passion-title {
        margin: 0 0 0.7rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: #e2e8f0;
        letter-spacing: -0.02em;
    }

    .passion-text {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.75;
        color: #64748b;
    }

    .card-blur {
        position: absolute;
        bottom: -30px;
        right: -30px;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%);
        pointer-events: none;
    }

    @media (max-width: 640px) {
        .passions-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
