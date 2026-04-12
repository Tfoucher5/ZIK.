<script>
    import { projects } from '../data.js';
    import ProjectModal from './ProjectModal.svelte';

    let activeProject = null;

    function openModal(project) {
        activeProject = project;
    }

    function closeModal() {
        activeProject = null;
    }

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

    // 3D tilt on hover
    function tilt(node) {
        let raf;

        function onMove(e) {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const rect = node.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                node.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(4px)`;
            });
        }

        function onLeave() {
            cancelAnimationFrame(raf);
            node.style.transform = '';
            node.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            setTimeout(() => { node.style.transition = ''; }, 500);
        }

        node.addEventListener('mousemove', onMove);
        node.addEventListener('mouseleave', onLeave);
        return {
            destroy() {
                node.removeEventListener('mousemove', onMove);
                node.removeEventListener('mouseleave', onLeave);
                cancelAnimationFrame(raf);
            }
        };
    }
</script>

<section id="projets" class="section">
    <div class="section-header" use:reveal>
        <span class="kicker">Projets</span>
        <h2 class="section-title">Sélection technique</h2>
        <p class="section-sub">Cliquez sur un projet pour voir les détails complets.</p>
    </div>

    <div class="projects-grid">
        {#each projects as project, i}
            <button
                class="project-card"
                use:reveal
                use:tilt
                style="--delay: {i * 120}ms"
                onclick={() => openModal(project)}
                aria-label="Voir les détails du projet {project.title}"
            >
                <!-- Status badge -->
                <div class="card-top">
                    {#if project.status === 'live'}
                        <span class="badge badge-live">
                            <span class="live-dot" aria-hidden="true"></span> Live
                        </span>
                    {:else}
                        <span class="badge badge-internal">Interne</span>
                    {/if}

                    <div class="card-arrow" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </div>
                </div>

                <!-- Tags -->
                <div class="tag-row">
                    {#each project.tags as tag}
                        <span class="tag">{tag}</span>
                    {/each}
                </div>

                <h3 class="project-title">{project.title}</h3>
                <p class="project-tagline">{project.tagline}</p>
                <p class="project-desc">{project.shortDesc}</p>

                <div class="card-footer">
                    <span class="view-detail">
                        Voir le projet
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </span>
                </div>
            </button>
        {/each}
    </div>
</section>

{#if activeProject}
    <ProjectModal project={activeProject} onClose={closeModal} />
{/if}

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
        color: #10b981;
        margin-bottom: 0.7rem;
    }

    .section-title {
        margin: 0 0 0.5rem;
        font-size: clamp(1.8rem, 4vw, 2.4rem);
        letter-spacing: -0.04em;
        color: #f1f5f9;
        font-weight: 800;
    }

    .section-sub {
        margin: 0;
        font-size: 0.9rem;
        color: #475569;
    }

    .projects-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
    }

    .project-card {
        position: relative;
        text-align: left;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.02);
        padding: 1.5rem;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.0rem;
        transition: border-color 0.3s, background 0.3s, box-shadow 0.3s;
        will-change: transform;
        overflow: hidden;
        font-family: inherit;
    }

    /* Shimmer gradient on hover */
    .project-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(
            circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(16, 185, 129, 0.06) 0%,
            transparent 60%
        );
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
    }

    .project-card:hover::before {
        opacity: 1;
    }

    .project-card:hover {
        border-color: rgba(16, 185, 129, 0.22);
        background: rgba(16, 185, 129, 0.02);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.04em;
    }

    .badge-live {
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.18);
        color: #6ee7b7;
    }

    .badge-internal {
        background: rgba(245, 158, 11, 0.08);
        border: 1px solid rgba(245, 158, 11, 0.14);
        color: #fcd34d;
    }

    .live-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #10b981;
    }

    .card-arrow {
        color: #334155;
        transition: color 0.2s, transform 0.2s;
    }

    .project-card:hover .card-arrow {
        color: #10b981;
        transform: translate(2px, -2px);
    }

    .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-bottom: 0.9rem;
    }

    .tag {
        padding: 0.22rem 0.55rem;
        border-radius: 5px;
        font-size: 0.72rem;
        font-weight: 500;
        background: rgba(16, 185, 129, 0.07);
        border: 1px solid rgba(16, 185, 129, 0.12);
        color: #6ee7b7;
    }

    .project-title {
        margin: 0 0 0.3rem;
        font-size: 1.2rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: #e2e8f0;
    }

    .project-tagline {
        margin: 0 0 0.7rem;
        font-size: 0.83rem;
        font-weight: 500;
        color: #475569;
    }

    .project-desc {
        flex: 1;
        margin: 0;
        font-size: 0.88rem;
        line-height: 1.7;
        color: #64748b;
    }

    .card-footer {
        margin-top: 1.3rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .view-detail {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.83rem;
        font-weight: 600;
        color: #334155;
        transition: color 0.2s;
    }

    .project-card:hover .view-detail {
        color: #6ee7b7;
    }

    @media (max-width: 900px) {
        .projects-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 600px) {
        .projects-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
