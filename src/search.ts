/** minúsculas y sin tildes, para buscar "camion" y encontrar "camión" */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
