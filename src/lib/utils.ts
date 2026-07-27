import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatLongDate(date: Date) {
  const weekday = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][date.getDay()];
  return `${weekday}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatShortDate(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

export function formatBirthLine(
  localDateTime: string,
  place: string,
  timeUnknown?: boolean,
) {
  const [date, time] = localDateTime.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const stamp = `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
  return timeUnknown
    ? `${stamp} · time unknown · ${place}`
    : `${stamp} · ${time} · ${place}`;
}
