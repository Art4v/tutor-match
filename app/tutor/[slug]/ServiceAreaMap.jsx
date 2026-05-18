"use client";
import dynamic from "next/dynamic";

const ServiceMapLeaflet = dynamic(() => import("@/components/ServiceMapLeaflet"), { ssr: false });

export default function ServiceAreaMap(props) {
  return <ServiceMapLeaflet {...props} />;
}
