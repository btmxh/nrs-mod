import { poke, xml } from "../lib.ts";

poke("**/*.xml", (document) => {
  xml
    .selectAll(document, "//source/urls/url[starts-with(@src, 'http://')]/@src")
    .forEach((value) => {
      const attr = value as Attr;
      attr.value = attr.value.replace("http", "https");
    });

  for (const urls of xml
    .selectAll(document, "//source/urls")
    .map((x) => x as Element)) {
    const children = Array.from(urls.children ?? [])
      .map((child) => child as Element)
      .sort((url1, url2) => {
        const name1 = url1.getAttribute("name") as string;
        const name2 = url2.getAttribute("name") as string;
        return name1 < name2 ? -1 : name1 === name2 ? 0 : 1;
      });

    for (let i = 0; i < children.length - 1; i++) {
      const url1 = children[i];
      const url2 = children[i + 1];
      for (const attr of Array.from(url1.attributes)) {
        if (url2.getAttribute(attr.name) !== attr.value) {
          continue;
        }
      }

      for (const attr of Array.from(url2.attributes)) {
        if (url1.getAttribute(attr.name) !== attr.value) {
          continue;
        }
      }

      children.splice(i, 1);
    }
  }
});
