# Create and push a new GitHub repo — step by step

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote set-url origin https://<USERNAME>:<PAT>@github.com/username/repo.git
git push -u origin main/master
```
