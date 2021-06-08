#!/bin/bash

if [ -d "node_modules" ]; then

    if [[ ! $(git rev-parse --abbrev-ref HEAD | grep deploy) ]]; then
        jsFiles=$(git diff --cached --name-only --diff-filter=ACM "*.js" "*.jsx" | tr '\n' ' ')
        [ -z "$jsFiles" ] && exit 0

        echo "$jsFiles" | xargs ./tasks/checkInjector.sh

        npx lint-staged;
    fi;
fi



