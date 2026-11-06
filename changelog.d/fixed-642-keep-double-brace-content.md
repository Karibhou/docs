- The docs renderer no longer deletes arbitrary `{{…}}` tokens, so promptargs
  blanks and `podman --format '{{.Mountpoint}}'` strings render intact
  (hivecommons/docs#642).
