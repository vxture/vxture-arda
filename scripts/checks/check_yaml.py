#!/usr/bin/env python3
import sys, yaml
for path in sys.argv[1:]:
    try:
        data = yaml.safe_load(open(path))
        jobs = data.get('jobs', {})
        print(f"[OK]   {path}")
        print(f"       Name: {data.get('name')}")
        print(f"       Jobs: {list(jobs.keys())}")
        for name, job in jobs.items():
            keys = list(job.keys())
            print(f"         {name}: {keys}")
    except Exception as e:
        print(f"[FAIL] {path}: {e}")
