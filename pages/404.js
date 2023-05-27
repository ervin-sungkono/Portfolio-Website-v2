import Link from "next/link"

import Particles from "react-tsparticles";
import { loadColorUpdater } from "tsparticles-updater-color";
import { loadCircleShape } from "tsparticles-shape-circle";
import { loadBaseMover } from "tsparticles-move-base";
import { loadSizeUpdater } from "tsparticles-updater-size";
import { loadOpacityUpdater } from "tsparticles-updater-opacity";
import { loadOutModesUpdater } from "tsparticles-updater-out-modes";

import Layout from "../components/layout/Layout";
import { useTheme } from "next-themes";

export default function NotFoundPage() {
    async function particlesInit(engine) {
        await loadColorUpdater(engine);
        await loadCircleShape(engine);
        await loadBaseMover(engine);
        await loadSizeUpdater(engine);
        await loadOpacityUpdater(engine);
        await loadOutModesUpdater(engine);
    }

    const {theme} = useTheme()
    return(
        <Layout title={"404 Not Found"} showNavbar={false} showFooter={false}>
            <Particles
                init={particlesInit}
                options={{
                    fpsLimit: 90,
                    particles: {
                        color: { value: theme === 'light' ? "#D5D5D5" : "#FFFFFF" },
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
            <div className="h-screen flex flex-col justify-center items-center">
                <div className="w-full max-w-md flex flex-col items-center px-8 py-12 shadow-lg dark:shadow-gray-700 border-[1px] border-black dark:border-white border-opacity-10 dark:border-opacity-20 rounded-lg gap-6">
                    <div className="text-3xl sm:text-5xl text-black dark:text-white font-bold">404 Not Found</div>
                    <Link href={"/"} className="btn btn-primary">Back to Home</Link>
                </div>
            </div>
        </Layout>
    )
}