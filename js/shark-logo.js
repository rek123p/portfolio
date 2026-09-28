// Hero badge — a real 3D extruded shark-logo "enamel badge", built from
// icons/brand-logo.png via a raster->vector->extrude pipeline (the traced
// shape data lives in js/shark-logo-shapes.js, loaded as a plain script
// right before this one so SHARK_SHAPE_DATA is a normal global).
//
// Two-tier fallback (simpler than cosmic-webgl.js's three-tier ladded on
// purpose — this badge isn't scene-lit by the page's sun like then Sun/
// Moon/Earth discs are, so there's no need for a pre-rendered frame
// filmstrip middle tier):
//  1. WebGL works, motion is allowed -> live 3D extruded badge (below)
//  2. WebGL doesn't, or the visitor
//     asked for a reduced motion     -> .hero-badge__fallback class,
//                                       CSS flat-spins icons/brand-logo.png
//
// Performance safeguards (added specifically because of the WebGL
// frame-rate throttling you ran into on real devices — logged as koszyk
// item (j) to also retrofit onto cosmic-webgl.js later):
//  - frame rate capped to ~30fps via a timestamp-delta gate, instead of
//    rendering flat-out on every rAF tick
//  - render loop paused via document.visibilitychange while the tab is
//    hidden
//  - render loop paused via IntersectionObserver while the badge is
//    scrolled off-screen
//  - prefers-reduced-motion skips WebGL entirely and goes straight to the
//    paused fallback

import { BufferGeometry } from "./vendor/three.module.min.js";

function isWebglAvailable() {
    try{
        const canvas = document.createElement("canvas");
        return !!(
            window.WebGLRenderingContext &&
            (canvas.getContext("webgl2") || canvas.getContext("webgl"))
        );
    } catch (err) {
        return false;
    }
}

function buildShapeFromSegments(THREE, segs) {
    const shape = new THREE.Shape();
    for (const s of segs) {
        if (s[0] === "M") shape.moveTo(s[1], s[2]);
        else if (s[0] === "L") shape.lineTo(s[1], s[2]);
        else if (s[0] === "C") shape.bezierCurveTo(s[1], s[2], s[3], s[4], s[5], s[6]);
        else if (s[0] === "Q") shape.quadraticCurveTo(s[1], s[2], s[3], s[4]);
        else if (s[0] === "Z") shape.closePath();
    }
    return shape;
}

function buildLayer(THREE, shapesData, colorHex, depth, frontZ) {
    const group = new THREE.Group();
    shapesData.forEach((sd) => {
        const shape = buildShapeFromSegments(THREE, sd.outer);
        sd.holes.forEach((h) => {
            shape.holes.push(buildShapeFromSegments(THREE, h));
        });
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: true,
            bevelThickness: depth * 0.08,
            bevelSize: depth * 0.06,
            bevelSegments: 4,
            curveSegments: 48,
        });
        geo.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.75,
            metalness: 0.15,
        });
        const mesh = new THREE.Mesh(geo, mat);
        // ExtrudeGeometry spans z=0..depth. frontZ places where that BACK face
        // lands, so the layer's front face ends up at frontZ+depth. Layers are
        // stacked (additive), not embedded: a shorter shape nested INSIDE a
        // taller solid's own footprint would be fully hidden behind the taller
        // one's flat opaque cap — gold has to sit forward of blue's front face
        // to actually be visible, it can't just be "inside" it.
        mesh.position.z = frontZ;
        group.add(mesh);
    });
    return group;
}

function setupScene(THREE, wrap, canvas) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.05, 5.2);

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (err) {
        wrap.classList.add("hero-badge--fallback");
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff2cc, 1.1);
    key.position.set(4, 6, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb9a6ff, 0.6);
    rim.position.set(-6, -2, -6);
    scene.add(rim);
    const fill = new THREE.PointLight(0xffffff, 0.35);
    fill.position.set(-4, 3, 6);
    scene.add(fill);

    // Blue base + gold layer stacked on top of it (gold sits proud of blue's
    // front face), each close to half the total thickness so the badge
    // reads as one solid, chunky whole — gold is only ~2px shallower than
    // blue (measured againstthe soource image's native 174x196 resolution).
    const BLUE_DEPTH = 0.125;
    const GOLD_DEPTH_RATIO = 0.2;
    const GOLD_DEPTH = BLUE_DEPTH * GOLD_DEPTH_RATIO;

    // Gold's back cap would otherwise land EXACTLY on blue's front cap (both
    // at z = BLUE_DEPTH/2) -- two dense, independently-triangulated flat
    // faces sitting perfectly coplanar. Depth-buffer precision differs
    // enough between GPUs/drivers (this is what broke on FIrefox's WebGL
    // back, even though Chromium tolerated it) that the renderer can't
    // reliably decide which face wins per-pixel, producing exactly the
    // jagged/torn, colors-showing-separately look. Fix: sink gold slughtly
    // INTO blue (a fraction of a percent of the total thickness) so the two
    // caps never coincide -- invisible from outside since it's swallowed by
    // opaque blue, but removes the tie entirely.
    const GOLD_EMBED = BLUE_DEPTH * 0.02;

    const root = new THREE.Group();
    root.add(buildLayer(THREE, SHARK_SHAPE_DATA.full, 0x1e4bc3, BLUE_DEPTH, -BLUE_DEPTH / 2));
    // Gold face on the FRONT, sinking slightly into blue's front cap.
    root.add(buildLayer(THREE, SHARK_SHAPE_DATA.gold, 0xf3cb34, GOLD_DEPTH, BLUE_DEPTH / 2 - GOLD_EMBED));
    // Gold face on the BACK too (mirrored), sinking slightly into blue's
    // back cap — badge is gold-plated on both sides, not just the front.
    root.add(buildLayer(THREE, SHARK_SHAPE_DATA.gold, 0xf3cb34, GOLD_DEPTH, -BLUE_DEPTH / 2 + GOLD_EMBED - GOLD_DEPTH));

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.children.forEach((g) =>
        g.children.forEach((m) => {
            m.position.x -= center.x;
            m.position.y -= center.y;
            m.position.z -= center.z;
        })
    );
    const size = box.getSize(new THREE.Vector3());
    const scaleFactor = 2.6 / Math.max(size.x, size.y);
    root.scale.set(scaleFactor, scaleFactor, scaleFactor);
    scene.add(root);

    const TARGET_FPS = 30;
    const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
    let rafId = null;
    let running = false;
    let lastFrameTime = 0;
    let t = 0;

    function resize() {
        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    function frame(now) {
        if (!running) return;
        rafId = requestAnimationFrame(frame);
        // Frame-rate cap: skip the actual update+render work unless enough
        // wall-clock time has passed, instead of rendering on every single
        // rAF tick (which is what was causing the reported throttling).
        if (now - lastFrameTime < FRAME_INTERVAL_MS) return;
        lastFrameTime = now;
        t += FRAME_INTERVAL_MS / 1000;
        root.rotation.y = t * 0.6;
        root.rotation.x = Math.sin(t * 0.4) * 0.08;
        resize();
        renderer.render(scene, camera);
    }

    function start() {
        if (running) return;
        running = true;
        lastFrameTime = 0;
        rafId = requestAnimationFrame(frame);
    }

    function stop() {
        running = false;
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
    }

    resize();
    renderer.render(scene, camera);
    start();

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stop();
        } else {
            const rect = wrap.getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < window.innerHeight) start();
        }
    });

    if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !document.hidden) start();
                    else stop();
                });
            },
            { threshold: 0.05 }
        );
        io.observe(wrap);
    }

    window.addEventListener("resize", resize);
}

function initHeroBadge() {
    const wrap = document.querySelector(".hero-badge");
    if (!wrap) return;
    const canvas = wrap.querySelector(".hero-badge__webgl");
    const prefersReducedMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (
        !canvas ||
        !isWebglAvailable() ||
        prefersReducedMotion ||
        typeof SHARK_SHAPE_DATA === "undefined"
    ) {
        wrap.classList.add("hero-badge--fallback");
        return;
    }

    import("./vendor/three.module.min.js")
        .then((THREE) => setupScene(THREE, wrap, canvas))
        .catch(() => {
            wrap.classList.add("hero-badge--fallback");
        });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeroBadge);
} else {
    initHeroBadge();
}