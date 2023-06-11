import { poke, xml } from "../lib.ts";

poke("**/*.xml", (document) => {
  xml.selectAll(document, "//source/urls/url/@src").forEach((value) => {
    const attr = value as Attr;
    attr.value = attr.value
      .replace("http:", "https:")
      .replace("music.youtube", "www.youtube");
  });

  xml
    .selectAll(
      document,
      "//source/urls/url[contains(@src, 'vgmdb') and contains(@src, 'trackindex')]"
    )
    .forEach((url) => {
      const elem = url as Element;
      (elem.parentNode as Element).removeChild(elem);
    });

  for (const urls of xml
    .selectAll(document, "//source/urls")
    .map((x) => x as Element)) {
    const children = Array.from(urls.childNodes ?? [])
      .map((child) => child as Element)
      .filter((child) => child?.tagName === "url")
      .sort((url1, url2) => {
        const name1 = url1.getAttribute("name") as string;
        const name2 = url2.getAttribute("name") as string;
        return name1 < name2 ? -1 : name1 === name2 ? 0 : 1;
      });

    const indexMap = new Map<string, number>();
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const key = child.getAttribute("name") + ":" + child.getAttribute("src");
      if (indexMap.has(key)) {
        const prevIndex = indexMap.get(key)!;
        const other = children[prevIndex];
        if (other.getAttribute("generatedBy") === null) {
          children.splice(i, 1);
        } else {
          children.splice(prevIndex, 1);
          i--;
          indexMap.set(key, i);
        }
      } else {
        indexMap.set(key, i);
      }
    }

    // loop: for (let i = 0; i < children.length - 1; i++) {
    //   const url1 = children[i];
    //   const url2 = children[i + 1];
    //   if (
    //     url1.getAttribute("name") !== url2.getAttribute("name") ||
    //     url1.getAttribute("src") !== url2.getAttribute("src")
    //   ) {
    //     continue loop;
    //   }

    //   if (url2.getAttribute("generatedBy") === null) {
    //     children.splice(i, 1);
    //   } else {
    //     children.splice(i + 1, 1);
    //   }
    // }

    for (const node of Array.from(urls.childNodes).map(
      (node) => node as Element
    )) {
      urls.removeChild(node);
    }

    for (const child of children) {
      urls.appendChild(child);
    }
  }
});
