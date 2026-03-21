export default class Utils {
  static formatDate = (dateStr) => {
    if (!dateStr) return "–";
    try {
      const d = new Date(dateStr + "T12:00:00");
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const y = d.getFullYear();
      return `${m}-${day}-${y}`;
    } catch {
      return dateStr;
    }
  };

  static setStore = (name, content) => {
    if (!name) return;
    if (typeof content !== "string") content = JSON.stringify(content);
    return window.localStorage.setItem(name, content);
  };
  static getStore = (name) => {
    if (!name) return;
    return JSON.parse(window.localStorage.getItem(name));
  };
  static removeItem = (name) => {
    if (!name) return;
    return window.localStorage.removeItem(name);
  };
}
