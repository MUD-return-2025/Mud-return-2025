// Этот файл использует функцию Vite `import.meta.glob` для автоматического
// импорта всех файлов команд в этой директории.
// Это позволяет добавлять новые команды, просто создавая новые файлы,
// без необходимости изменять этот файл или GameEngine.

const modules = import.meta.glob('./*.js', { eager: true });

const commands = [];
for (const path in modules) {
  commands.push(modules[path].default);
}

export default commands;
