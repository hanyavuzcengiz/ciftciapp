import { Redirect } from "expo-router";
import { hrefSplash } from "./lib/paths";

export default function Index() {
  return <Redirect href={hrefSplash} />;
}
