l = console.log;

Vue.component('media-item', {
    props : ["item", "active"],

    mounted : function(){
        l("new media-item " + this.item.filename + ", active : " + this.active)
    },
    computed : {
        url() {
            return `album/${this.item.relativeDir}/${this.item.filename}`
        }
    },
    template : `
        <div>
            <a :href="url" target="_blank">
                <img class="img-fluid" :src="url" />
            </a>
        </div>
    `

});


Vue.component('itemhandler', {
    props : ["mediaItems"],
    data() {
        return {
            active : 0
        }
    },

    methods : {

        add(i){
            this.active += i;
            if(this.active < 0)
                this.active = 0
            if(this.mediaItems.length - 1 < this.active)
                this.active = this.mediaItems.length - 1
        },

        open() {
            let item = this.mediaItems[this.active];
            if (item){
                let url = `album/${item.relativeDir}/${item.filename}`
                window.open(url);
            }
        },

        keyEvent(evt){

            switch(evt.key){
                case "a":
                    this.add(-1);
                break;
                case "d":
                    this.add(1);
                    break;
                case "w":
                    this.add(-6);
                    break;
                case "s":
                    this.add(6);
                    break;
                case "q":
                    this.open();
                    break;

            }
        }
    },

    created : function(){
        document.addEventListener('keyup', this.keyEvent);
    },
    destroyed : function(){
        document.removeEventListener('keyup', this.keyEvent);
    },

    template : `
        <div>
            itemHandler - {{ mediaItems.length}}
            <div class="row">
                <div class="col-md-2" v-for="(mediaItem, i) in mediaItems" 
                    :class="{ihActive : active === i, ihInactive : active !== i}">
                    <media-item :item="mediaItem"></media-item>
                </div>           
            </div> 
        </div>
    `
});