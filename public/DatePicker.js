l = console.log;

Vue.component('datepicker-range', {
    props : ['from', 'to', 'active', 'activeLevel'],
    computed : {
        range() {
            return _.range(this.from, this.to + 1)
        }
    },
    template : `
        <div class="rangeHolder">
            <div style="width: 50px">
                <div v-if="activeLevel"> -> </div>
            </div>
            <div class="day" v-for="i in range" :class="{active : i == active}" @click="$emit('click', i)">
                {{ i }}
            </div>
        </div>
    `
});

Vue.component('datepicker', {
    props : ['currentDate', 'locked'],
    data() {
        return {
            level : "days"
        }
    },

    methods : {
        yearClicked(year){
            this.emitDate(this.currentDate.year(year));
            this.$forceUpdate();
        },
        monthClicked : function(month){
            this.emitDate(this.currentDate.month(month-1));
            this.$forceUpdate();
        },
        dayClicked(day){
            this.emitDate(this.currentDate.date(day));S
            this.$forceUpdate();
        },

        emitDate(date){
            this.$emit('date-selected', date);
        },

        levelUp(){
            this.level = {
                "days" : "months",
                "months" : "years",
                "years" : "years"
            }[this.level]
        },
        levelDown(){
            this.level = {
                "days" : "days",
                "months" : "days",
                "years" : "months"
            }[this.level]
        },

        add(){
            this.emitDate(moment(this.currentDate).add(1, this.level))
        },

        subtract(){
            this.emitDate(moment(this.currentDate).subtract(1, this.level))
        },

        isActiveLevel(level){
            return level === this.level;
        },

        keyEvent(evt){

            if(this.locked)
                return;

            switch(evt.key){
                case "A":
                    this.subtract();
                    break;
                case "D":
                    this.add();
                    break;
                case "W":
                    this.levelUp();
                    break;
                case "S":
                    this.levelDown();
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
        <div :class="{borderTopEnabled : !locked, borderTopDisabled : locked}">
            <datepicker-range class="orange" :activeLevel="isActiveLevel('years')"  :from=2000 :to=2020 :active="currentDate.year()"  v-on:click="yearClicked"  ></datepicker-range>
            <datepicker-range class="blue"   :activeLevel="isActiveLevel('months')" :from=1 :to=12      :active="currentDate.month()+1" v-on:click="monthClicked" ></datepicker-range>
            <datepicker-range class="orange" :activeLevel="isActiveLevel('days')"   :from=1 :to=31      :active="currentDate.date()"  v-on:click="dayClicked"   ></datepicker-range>
        </div>
    `
});