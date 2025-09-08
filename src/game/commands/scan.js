export default {
  name: 'scan',
  aliases: ['скан', 'сканировать'],
  description: 'показать врагов в соседних комнатах',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    const c = game.colorize;
    const radarData = game.scanForHostiles();

    const header = c('---[ Сканирование ]--------', 'room-name');
    const footer = c('---------------------------', 'room-name');
    const lines = [];

    if (radarData.length === 0) {
      lines.push('  Поблизости нет врагов.');
    } else {
      radarData.forEach(entry => {
        const hostilesString = entry.hostiles
          .map(hostile => {
            const countStr = hostile.count > 1 ? c(` (x${hostile.count})`, 'combat-npc-death') : '';
            return `${c(hostile.name, 'npc-hostile')}${countStr}`;
          })
          .join(', ');

        let line;
        switch (entry.direction) {
          case 'север':
            line = `  На ${c('севере', 'exit-name')}: ${hostilesString}`;
            break;
          case 'юг':
            line = `  На ${c('юге', 'exit-name')}: ${hostilesString}`;
            break;
          case 'восток':
            line = `  На ${c('востоке', 'exit-name')}: ${hostilesString}`;
            break;
          case 'запад':
            line = `  На ${c('западе', 'exit-name')}: ${hostilesString}`;
            break;
          case 'вверх':
            line = `  ${c('Наверху', 'exit-name')}: ${hostilesString}`;
            break;
          case 'вниз':
            line = `  ${c('Внизу', 'exit-name')}: ${hostilesString}`;
            break;
          default:
            line = `  В направлении "${c(entry.direction, 'exit-name')}": ${hostilesString}`;
        }
        lines.push(line);
      });
    }

    return [header, ...lines, footer].join('\n');
  }
};