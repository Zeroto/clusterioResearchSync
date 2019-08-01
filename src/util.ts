import fs from 'fs';

const COMPRESS_LUA = false;

async function getSafeLua(filePath: string) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, contents) => {
      if (err) {
        reject(err);
      } else {
        // split content into lines
        const split = contents.split(/\r?\n/);

        // join those lines after making them save again
        contents = split.reduce((acc, val) => {
          val = val.replace(/\\/g, '\\\\');
          // remove leading and trailing spaces
          val = val.trim();
          // escape single quotes
          val = val.replace(/'/g, '\\\'');

          // remove single line comments
          let singleLineCommentPosition = val.indexOf("--");
          let multiLineCommentPosition = val.indexOf("--[[");

          if (multiLineCommentPosition === -1 && singleLineCommentPosition !== -1) {
            val = val.substr(0, singleLineCommentPosition);
          }

          return acc + val + '\\n';
        }, ""); // need the "" or it will not process the first row, potentially leaving a single line comment in that disables the whole code

        // console.log(contents);

        // this takes about 46 ms to minify train_stop_tracking.lua in my tests on an i3
        if (COMPRESS_LUA) contents = require("luamin").minify(contents);

        resolve(contents);
      }
    });
  });
}

async function checkHotpatchInstallation(messageInterface: ((command: string) => Promise<string>)) {
  let yn = await messageInterface("/silent-command if remote.interfaces['hotpatch'] then rcon.print('true') else rcon.print('false') end");
  yn = yn.replace(/(\r\n\t|\n|\r\t)/gm, "");
  if (yn == "true") {
    return true;
  } else if (yn == "false") {
    return false;
  }
}

export {
  getSafeLua,
  checkHotpatchInstallation
}