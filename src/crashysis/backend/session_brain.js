class SessionBrain {
  constructor({ rep, rootDB }) {
    this.loaded = false;
    this.rootDB = rootDB;
    this.crashDB = null;

    this.id = rep.id;
    this.name = rep.name;
  }

  modify(mods) {
    if (mods.name) {
      this.name = mods.name;
    }

    return this.save();
  }

  save() {
    return this.rootDB.saveSession({
      id: this.id,
      name: this.name,
    })
  }
}
