const files = ['data.test.ts', 'lcu-client.test.ts', 'game-session.test.ts', 'desktop-logic.test.ts'];
let failed = 0;
for (const file of files) {
  console.log('\n===== ' + file + ' =====');
  try {
    await import('./' + file);
  } catch (error) {
    failed += 1;
    console.error(file + ' 失败：', error);
  }
}
if (failed > 0) {
  console.error('\n' + failed + ' 个测试文件失败 ❌');
  process.exit(1);
}
console.log('\n全部测试文件通过 ✅');
export {};
