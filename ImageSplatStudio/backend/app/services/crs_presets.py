"""Japanese CRS presets (Civil 3D / GSI JGD2011)."""

from __future__ import annotations

JGD2011_PLANE_NAMES: dict[int, str] = {
    6669: "01",
    6670: "02",
    6671: "03",
    6672: "04",
    6673: "05",
    6674: "06",
    6675: "07",
    6676: "08",
    6677: "09",
    6678: "10",
    6679: "11",
    6680: "12",
    6681: "13",
    6682: "14",
    6683: "15",
    6684: "16",
    6685: "17",
    6686: "18",
    6687: "19",
}


def crs_name_for_epsg(epsg: int) -> str:
    if epsg == 6668:
        return "JGD2011 (Latitude-Longitude)"
    if epsg in JGD2011_PLANE_NAMES:
        no = JGD2011_PLANE_NAMES[epsg]
        return f"Japan Geodetic Datum 2011 Plane No. {no}"
    if epsg == 4326:
        return "WGS84"
    if epsg == 0:
        return "Local"
    return f"EPSG:{epsg}"
