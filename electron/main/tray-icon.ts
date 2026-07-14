export const TRAY_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <g fill="black">
    <circle cx="4" cy="4" r="2.25"/>
    <circle cx="14" cy="4" r="2.25"/>
    <circle cx="9" cy="14" r="2.25"/>
    <path d="M5.7 5.45 7.75 11h2.5l2.05-5.55-1.88-.7L9 8.58 7.58 4.75z"/>
  </g>
</svg>`;

const TRAY_ICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAABRmlDQ1BJQ0MgUHJvZmlsZQAAKJF9kD1LA0EQhp9oQsAvLIQIWlwjKETRKFpYxRRBEIzx2+5yiYmQxOXu/Crtra1t9BcIKWwsbawCKv4BwVZIo+GczamJis4yzLPvzswOA21BU6liECiVXTudnDM2NreM8DMhIiJG6DEtR8VTqQW58Rm/W+2OgI7VUd3r9/u/1pHNOZbEN/GopWwXAsPCqQNXaT4U7rNlKOETzXmfzzRnfL5s5KykE8I3wr1WwcwKP+iemRY938Kl4p71MYOevitXXl3WuvggaySJMUOcJSaI/5E71chNsIviCJsd8hRwMaROySmSE56njMUYUeEY4+LTesc/d9fUjq9gdkC+cpra4jlU+mW8p6Y2tA/dt3BdVaZtfm00UAs625MxnzsrEDr1vJd1CI9A/d7zXiueV7+A9keprb0DDsBbKRm5VasAAABsZVhJZk1NACoAAAAIAAQBGgAFAAAAAQAAAD4BGwAFAAAAAQAAAEYBKAADAAAAAQACAACHaQAEAAAAAQAAAE4AAAAAAAAAkAAAAAEAAACQAAAAAQACoAIABAAAAAEAAAAkoAMABAAAAAEAAAAkAAAAAEAkCvoAAAAJcEhZcwAAFiUAABYlAUlSJPAAAAHDSURBVFgJ7VY7TsNAEA2mQxAJIUGZmgrKFBQUwEHouAYVJ+AAhpbQAwdAdNwgEjT0QEEBvCd7pJd1vOza2SREGWk0vzcf78d2p7Okf7YCK5559xDrl/FHyGcPNiTUuF4X1XPwj8P0MRZLreuNG8aGYyyWWtXjslrzOklMKEXXy5zKdmYc94gZgrGEEOwIxh3ICs2NDF1i3s5DcG/M5PQxRkxoPUDrKUeo7vwMEDsHD0vMBaRL9DF/CCb2BlxXj73+JN81PUO2Fn+FnUlF6vQphjlsrD7q9FVeI7EvxnUUeQOvgY1OoNyXxjHknQUgP8E74Hcwt88O8CRetChX0BWEPu21BSCpa4zY5HSEDtr0A/ZGydQ1Rmxy4jl5AWvjU9hk9RFDbBStRqELMJtugw8kdxP6PrgnvkvoD2InVXdRXVfjGzZZfcRMlZ7QTQdQnbFGFL3H0iUX3VV9MRc7MXsLlb7AujLU6WNsJnSLru5A9C0O+T4doU+Z7JMQOoDhfB/hykfTklJK3iT3/Jg99VvGbbLmdZKYaMqiM4oE+43wpYdgKvlNB6oUmrUj2Za1ebC5OtR8kCTXfqFejG22e5nbeAV+AYN52EovVeoMAAAAAElFTkSuQmCC';

export function trayIconDataUrl(): string {
  return `data:image/png;base64,${TRAY_ICON_PNG_BASE64}`;
}

export function createTrayMenuTemplate(handlers: {
  showMain: () => void;
  toggleFloating: () => void;
  quit: () => void;
}): MenuItemConstructorOptions[] {
  return [
    { label: '打开主面板', click: handlers.showMain },
    { label: '显示/隐藏悬浮窗', click: handlers.toggleFloating },
    { type: 'separator' },
    { label: '退出', click: handlers.quit },
  ];
}
import type { MenuItemConstructorOptions } from 'electron';
