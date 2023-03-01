import dynamic from "next/dynamic"

const Layout = dynamic(() => import("../components/Layout"))
const DribbbleSection = dynamic(() => import("../components/DribbbleSection"))
import { getDribbbleUserData } from "../lib/fetch"

export default function Dribbble({dribbbleShots}) {
    return(
        <Layout title={"Ervin | Dribbble"}>
            <DribbbleSection title={"My Dribbble shots!"} dribbbleShots={dribbbleShots}/>
        </Layout>
    )
}

export async function getStaticProps(){
    const dribbbleData = await getDribbbleUserData()
  
    return{
      props:{
        dribbbleShots: dribbbleData,
      }
    }
  }