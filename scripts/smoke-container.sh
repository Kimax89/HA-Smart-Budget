#!/usr/bin/env bash
set -euo pipefail

variant="${1:?Pass Dockerfile or Dockerfile.standalone}"
container=budget-ci
volume=budget-ci
trap 'docker logs "$container"; docker rm -f "$container" >/dev/null; docker volume rm "$volume" >/dev/null; docker network rm budget-ci >/dev/null 2>&1 || true' EXIT
docker volume create "$volume"

# Reproduce data created by the previous root-running image, then verify upgrade.
seed_user=node
if [[ "$variant" == Dockerfile ]]; then seed_user=root; fi
docker run --rm --user "$seed_user" --entrypoint node -v "$volume:/data" budget-check --input-type=module -e "
import {BudgetStore} from './src/store.js';
const store = new BudgetStore('/data/budget.sqlite');
const month = store.get('2030-01');
store.save('2030-01', {people:[{id:'test',name:'Testperson',income:100,allocation:'auto',value:0}],accounts:[],items:[]}, month.revision);
store.close();"

if [[ "$variant" == Dockerfile ]]; then
    docker network create --subnet 172.30.32.0/24 budget-ci
    docker run -d --init --name "$container" --network budget-ci --ip 172.30.32.3 -v "$volume:/data" budget-check
    request() {
        docker run --rm --network budget-ci --ip 172.30.32.2 --entrypoint node budget-check -e "fetch('http://budget-ci:8099/$1').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))"
    }
else
    docker run -d --init --name "$container" -p 127.0.0.1:8099:8099 -v "$volume:/data" budget-check
    request() { curl --fail --silent "http://127.0.0.1:8099/$1"; }
fi

wait_for_server() {
    for attempt in $(seq 1 30); do
        if request api/health; then return; fi
        sleep 1
    done
    return 1
}
wait_for_server
request api/months/2030-01 | grep Testperson
for module in app budget model validation payments; do request "$module.js" >/dev/null; done
# The init process can be root; the application process must not be.
docker top "$container" -eo uid,comm | awk '$2 == "node" { found=1; if ($1 == 0) exit 1 } END { if (!found) exit 1 }'
if [[ "$variant" == Dockerfile ]]; then
    docker run --rm --network budget-ci --entrypoint node budget-check -e "fetch('http://budget-ci:8099/').then(r=>process.exit(r.status===403?0:1))"
fi
docker restart "$container"
wait_for_server
request api/months/2030-01 | grep Testperson
