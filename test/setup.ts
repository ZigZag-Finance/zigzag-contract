const spawn = require("child_process").spawn;

const SCRIPT_PATH = "./scripts/node-start.sh";

export function setupNode() {
  let t0 = Date.now();
  return new Promise((resolve, reject) => {
    const cmd = spawn(SCRIPT_PATH);
    process.stdout.write("\n");
    cmd.stdout.on("data", data => {
      const dt = Date.now() - t0;
      process.stdout.write(`==> ${data.toString().trimRight()} +${dt}ms\n`);
      t0 = Date.now();
    });
    cmd.stderr.on("data", data => {
      const dt = Date.now() - t0;
      process.stdout.write(`!!! ${data.toString().trimRight()} +${dt}ms\n`);
      t0 = Date.now();
    });
    cmd.on("error", error => {
      console.error(error);
      reject(error);
    });
    cmd.on("close", code => {
      if (code === 0) {
        resolve();
      }
    });
  });
}
