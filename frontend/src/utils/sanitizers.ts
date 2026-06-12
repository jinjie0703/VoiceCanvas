export const sanitizeColor = (color: unknown, defaultColor: string): string => {
  if (!color || typeof color !== "string") return defaultColor;
  const lowerColor = color.toLowerCase();
  if (lowerColor === "gray") return "grey";

  const validColors = [
    "black",
    "grey",
    "light-violet",
    "violet",
    "blue",
    "light-blue",
    "yellow",
    "orange",
    "green",
    "light-green",
    "light-red",
    "red",
    "white",
  ];
  if (validColors.includes(lowerColor)) return lowerColor;
  return defaultColor;
};

export const sanitizeGeo = (geo: unknown, defaultGeo: string): string => {
  if (!geo || typeof geo !== "string") return defaultGeo;
  const lowerGeo = geo.toLowerCase();
  if (lowerGeo === "circle") return "ellipse";
  if (lowerGeo === "square") return "rectangle";

  const validGeos = [
    "rectangle",
    "ellipse",
    "triangle",
    "diamond",
    "pentagon",
    "hexagon",
    "octagon",
    "star",
    "rhombus",
    "oval",
    "cloud",
  ];
  if (validGeos.includes(lowerGeo)) return lowerGeo;
  return defaultGeo;
};
