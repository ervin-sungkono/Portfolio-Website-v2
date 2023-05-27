import dynamic from "next/dynamic"

import Layout from "../components/layout/Layout"
const DribbbleSection = dynamic(() => import("../components/design/DribbbleSection"))
import { getDribbbleUserData } from "../lib/fetch"

export default function Dribbble({dribbbleShots}) {
    return(
        <Layout title={"Ervin | Design"}>
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