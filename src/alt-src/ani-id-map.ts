import { poke, xml } from "../lib.ts";

await poke("**/*.xml", (document) => {
  const node = xml.select(document, '//entry[@id="A-MAL-38009"]/bestGirl');
  if(node !== undefined) {
    (xml.select(node as Node, "@name") as Attr).value = "howan love";
    (node as Element).setAttribute("generatedBy", "ani_id_map.ts v0.1.0");

    console.log("hello");
    (node as Attr).value = "chao em co gai howan tinhf";
    console.debug(node);
  }
});
