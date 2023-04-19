import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback } from "react"

import Particles from "react-tsparticles";
import { loadColorUpdater } from "tsparticles-updater-color";
import { loadCircleShape } from "tsparticles-shape-circle";
import { loadBaseMover } from "tsparticles-move-base";
import { loadSizeUpdater } from "tsparticles-updater-size";
import { loadOpacityUpdater } from "tsparticles-updater-opacity";
import { loadOutModesUpdater } from "tsparticles-updater-out-modes";

const Layout = dynamic(() => import("../components/Layout"))

export default function NotFoundPage() {
    async function particlesInit(engine) {
        await loadColorUpdater(engine);
        await loadCircleShape(engine);
        await loadBaseMover(engine);
        await loadSizeUpdater(engine);
        await loadOpacityUpdater(engine);
        await loadOutModesUpdater(engine);
    }

    return(
        <Layout title={"404 Not Found"} showNavbar={false} showFooter={false}>
            <Particles
                init={particlesInit}
                options={{
                    fpsLimit: 90,
                    particles: {
                        color: { value: "#ffffff" },
                        move: {
                            direction: "none",
                            enable: true,
                            outModes: "out",
                            random: false,
                            speed: 2,
                            straight: false
                        },
                        number: { density: { enable: true, area: 800 }, value: 80 },
                        opacity: {
                            value: 0.5
                        },
                        shape: {
                            type: "circle"
                        },
                        size: {
                            value: { min: 1, max: 5 }
                        }
                    }
                }}
            />
            <div className="h-screen flex flex-col gap-6 justify-center items-center">
                <div className="text-3xl sm:text-5xl text-black dark:text-white font-bold">404 Not Found</div>
                <Link href={"/"} className="btn btn-primary">Back to Home</Link>
            </div>
        </Layout>
    )
}