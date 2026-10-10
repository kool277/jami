const fs = require("fs");
const path = require("path");
const typescript = require("typescript");

module.exports = {
  input: ["src/**/*.{js,jsx,ts,tsx,html}", "!src/**/*.d.ts"],
  output: "./",
  options: {
    debug: true,
    func: {
      list: ["i18next.t", "i18n.t", "this.i18n.tr"],
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
    lngs: ["en", "fr"],
    ns: ["translation"],
    defaultLng: "en",
    defaultNs: "translation",
    defaultValue: "__STRING_NOT_TRANSLATED__",
    resource: {
      loadPath: "public/locales/{{lng}}/{{ns}}.json",
      savePath: "public/locales/{{lng}}/{{ns}}.json",
      jsonIndent: 4,
      lineEnding: "\n",
    },
    nsSeparator: false, // namespace separator
    keySeparator: false, // key separator
    interpolation: {
      prefix: "{{",
      suffix: "}}",
    },
    removeUnusedKeys: true,
  },

  transform: function customTransform(file, enc, done) {
    "use strict";
    const parser = this.parser;
    const { base, ext } = path.parse(file.path);
    const content = fs.readFileSync(file.path, enc);

    if (ext === ".ts" || ext === ".tsx") {
      const { outputText } = typescript.transpileModule(content.toString(), {
        compilerOptions: {
          target: "es2018",
        },
        fileName: base,
      });

      let count = 0;

      parser.parseFuncFromString(
        outputText,
        { list: ["i18next.t", "i18next.tr", "this.i18n.tr"] },
        (key, options) => {
          parser.set(
            key,
            Object.assign({}, options, {
              nsSeparator: false,
              keySeparator: false,
            }),
          );
          ++count;
        },
      );

      if (count > 0) {
        const c = count.toString().padStart(3, " ");
        const f = JSON.stringify(file.relative);
        console.log(`i18next-scanner: count=${c}, file=${f}`);
      }
    } else if (ext === ".html") {
      this.parser.parseAttrFromString(content, {
        list: ["data-i18n", "data-t", "t", "i18n"],
      });

      // We extra behaviours `${ 'myKey' | t }` and `${ 'myKey' & t }` from the file.
      const extractBehaviours = /\${ *'([a-zA-Z0-9]+)' *[&|] *t *}/g;
      const strContent = content.toString();

      let group = extractBehaviours.exec(strContent);

      while (group !== null) {
        this.parser.set(group[1]);
        group = extractBehaviours.exec(strContent);
      }
    }

    done();
  },
};
