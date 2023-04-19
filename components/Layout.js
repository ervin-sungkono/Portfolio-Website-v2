import Head from "next/head";
import dynamic from "next/dynamic";

const Navbar = dynamic(() => import("./Navbar"))
const Footer = dynamic(() => import("./Footer"))

export default function Layout({title, description = "", children, showNavbar = true, showFooter = true}){
    return(
        <>
            <Head>
                <title>{title}</title>
                <meta name="description" content={description}></meta>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            {showNavbar && <Navbar/>}
            <main className={`container mx-auto ${showNavbar && "pt-20 lg:pt-18"}`}>
                {children}
            </main>
            {showFooter && <Footer/>}
        </>
    )
}